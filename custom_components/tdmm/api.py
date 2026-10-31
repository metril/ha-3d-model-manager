"""REST client for the 3DMM ext v2 API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal
from urllib.parse import urlsplit

import aiohttp
import voluptuous as vol

from .exceptions import TdmmAuthError, TdmmCameraWarming, TdmmConnectionError, TdmmScopeError
from .models import PingResult, PrinterInfo

if TYPE_CHECKING:
    from collections.abc import Iterable

_DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=15)
_DEFAULT_PORTS = {"http": 80, "https": 443}


def normalize_url(url: str) -> str:
    """Lowercase scheme/host, drop default port and trailing slash; reject non-http(s)."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    if scheme not in _DEFAULT_PORTS or not parts.hostname:
        raise vol.Invalid("invalid_url")
    host = parts.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    try:
        port = parts.port
    except ValueError as err:
        raise vol.Invalid("invalid_url") from err
    netloc = host if port is None or port == _DEFAULT_PORTS[scheme] else f"{host}:{port}"
    return f"{scheme}://{netloc}{parts.path.rstrip('/')}"


class TdmmApiClient:
    """Thin async wrapper over the 3DMM ext v2 REST surface."""

    sse_sock_read: float = 45

    def __init__(self, session: aiohttp.ClientSession, base_url: str, api_key: str) -> None:
        self._session = session
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        timeout: aiohttp.ClientTimeout = _DEFAULT_TIMEOUT,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        ok_statuses: tuple[int, ...] = (),
    ) -> aiohttp.ClientResponse:
        """Issue a request; map errors. Caller must release/close the returned response."""
        hdrs = {"X-API-Key": self._api_key, **(headers or {})}
        try:
            resp = await self._session.request(
                method, f"{self.base_url}{path}", json=json, timeout=timeout, params=params, headers=hdrs
            )
        except (aiohttp.ClientError, TimeoutError) as err:
            raise TdmmConnectionError(f"{method} {path} failed: {err}") from err
        if resp.status < 300 or resp.status in ok_statuses:
            return resp
        status = resp.status
        retry = resp.headers.get("Retry-After")
        resp.release()
        if status == 401:
            raise TdmmAuthError("API key rejected")
        if status == 403:
            raise TdmmScopeError("API key lacks required scope")
        if status == 503 and path.endswith("/camera/snapshot"):
            try:
                after = float(retry) if retry is not None else 2.0
            except ValueError:
                after = 2.0
            raise TdmmCameraWarming(after)
        raise TdmmConnectionError(f"{method} {path} returned HTTP {status}")

    async def _json(self, method: str, path: str, **kw: Any) -> Any:
        resp = await self._request(method, path, **kw)
        try:
            return await resp.json(content_type=None)
        except (aiohttp.ClientError, ValueError, TimeoutError) as err:
            raise TdmmConnectionError(f"{method} {path} bad response: {err}") from err
        finally:
            resp.release()

    async def _bytes(self, path: str, **kw: Any) -> bytes | None:
        resp = await self._request("GET", path, **kw)
        try:
            if resp.status == 404:
                return None
            return await resp.read()
        except (aiohttp.ClientError, TimeoutError) as err:
            raise TdmmConnectionError(f"GET {path} failed: {err}") from err
        finally:
            resp.release()

    async def ping(self) -> PingResult:
        return PingResult.from_dict(await self._json("GET", "/api/ext/v2/ping"))

    async def printers(self) -> list[PrinterInfo]:
        data = await self._json("GET", "/api/ext/v2/printers")
        items = data.get("printers", data) if isinstance(data, dict) else data
        return [PrinterInfo.from_dict(p) for p in items]

    async def status(self, printer_id: int) -> dict[str, Any]:
        return await self._json("GET", f"/api/ext/v2/printers/{printer_id}/status")

    async def command(self, printer_id: int, action: Literal["pause", "resume", "stop"]) -> None:
        resp = await self._request("POST", f"/api/ext/v2/printers/{printer_id}/{action}")
        resp.release()

    async def control(
        self,
        printer_id: int,
        name: Literal["temperature", "fan", "light", "speed", "home", "clear-hms"],
        body: dict[str, Any],
    ) -> None:
        resp = await self._request("POST", f"/api/ext/v2/printers/{printer_id}/control/{name}", json=body)
        resp.release()

    async def camera_snapshot(self, printer_id: int) -> bytes:
        data = await self._bytes(f"/api/ext/v2/printers/{printer_id}/camera/snapshot")
        return data or b""

    async def open_camera_stream(self, printer_id: int) -> aiohttp.ClientResponse:
        return await self._request(
            "GET",
            f"/api/ext/v2/printers/{printer_id}/camera/stream",
            timeout=aiohttp.ClientTimeout(total=None, sock_read=30),
        )

    async def thumbnail(self, printer_id: int) -> bytes | None:
        return await self._bytes(f"/api/ext/v2/printers/{printer_id}/thumbnail", ok_statuses=(404,))

    async def open_events(self, printer_ids: Iterable[int]) -> aiohttp.ClientResponse:
        ids = ",".join(str(i) for i in sorted(printer_ids))
        return await self._request(
            "GET",
            "/api/events",
            params={"printer_ids": ids},
            headers={"Accept": "text/event-stream"},
            timeout=aiohttp.ClientTimeout(total=None, sock_read=self.sse_sock_read),
        )
