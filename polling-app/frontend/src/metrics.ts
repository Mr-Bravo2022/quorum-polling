/**
 * Fire-and-forget client metric reporting (Observability).
 *
 * Reports browser-side events the backend can't see on its own — an audience
 * member successfully joining a poll, or the camera being denied so they fell
 * back to the manual code box. These feed the RED view at GET /api/metrics.
 * Best-effort: failures are swallowed so telemetry never affects the UX.
 */
export type ClientMetric = 'join_success' | 'camera_fallback';

export function reportMetric(type: ClientMetric): void {
  try {
    fetch('/api/metrics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => { /* ignore — telemetry is best-effort */ });
  } catch {
    /* ignore */
  }
}
