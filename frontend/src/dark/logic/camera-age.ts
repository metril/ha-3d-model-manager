/** Camera freshness as reported by 3D Model Manager >= 0.26 in the camera entity's `camera_state` attribute. */
export type CameraState = "live" | "stalled" | "warming" | "unknown";

/** `off`, absent or unrecognised values are "unknown": the card falls back to its own stream-loading state. */
export function cameraState(attr: unknown): CameraState {
  return attr === "live" || attr === "stalled" || attr === "warming" ? attr : "unknown";
}
