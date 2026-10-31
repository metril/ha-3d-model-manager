interface CardHelpers {
  createCardElement(config: Record<string, unknown>): unknown;
  importMoreInfoControl?: unknown;
}
interface HaWindow { loadCardHelpers?: () => Promise<CardHelpers> }

const loaded = () => !!customElements.get("hui-image") && !!customElements.get("ha-form");

/** Forces HA to lazy-load hui-image and ha-form. Never throws. */
export async function ensureHaElements(timeoutMs = 5000): Promise<void> {
  if (loaded()) return;
  try {
    const helpers = await (window as unknown as HaWindow).loadCardHelpers?.();
    if (helpers) {
      const card = (await helpers.createCardElement({ type: "picture-entity", entity: "camera.x" })) as
        { constructor?: { getConfigElement?: () => Promise<unknown> } } | undefined;
      await card?.constructor?.getConfigElement?.();
    }
  } catch { /* best effort */ }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((res) => { timer = setTimeout(res, timeoutMs); });
  try {
    await Promise.race([
      Promise.all([customElements.whenDefined("hui-image"), customElements.whenDefined("ha-form")]).then(() => undefined),
      timeout,
    ]);
  } finally { clearTimeout(timer); }
}
