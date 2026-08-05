/**
 * QrJoinSource — the Adapter (GoF) that hides the browser's camera + QR-decoding
 * APIs behind a small, stable interface the UI can talk to.
 *
 * The UI (ScanToJoin) knows only these four verbs. It never calls
 * getUserMedia, never touches a MediaStreamTrack, and never constructs a
 * BarcodeDetector directly. That decoupling is the point of the Adapter: we can
 * swap the concrete source (a real camera today, a WASM decoder tomorrow, or a
 * fake in tests) without changing a line of the UI.
 */

export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface QrJoinSource {
  /** Can this source run in the current browser? (camera + a QR decoder present) */
  isSupported(): boolean;

  /** Current camera permission, queried WITHOUT prompting the user. */
  getPermission(): Promise<CameraPermission>;

  /**
   * Start scanning. Opens the camera into `video` and invokes `onResult` with
   * the raw text of the first QR code seen. MUST be called from a user gesture
   * (e.g. a click) so the browser allows the camera prompt.
   */
  start(video: HTMLVideoElement, onResult: (text: string) => void): Promise<void>;

  /** Stop scanning and release the camera (calls track.stop()). Safe to call twice. */
  stop(): void;
}

/**
 * Pull a poll id out of whatever the QR encoded. Our join links look like
 * `https://host/#<pollId>`, but we also accept a bare id or `#<pollId>` so the
 * manual-entry fallback is forgiving.
 */
export function extractPollId(text: string): string | null {
  if (!text) return null;

  // A full URL with a #<pollId> fragment (what our QR codes encode).
  try {
    const hash = new URL(text).hash.replace(/^#/, '').trim();
    if (hash) return hash;
  } catch {
    /* not a URL — fall through */
  }

  // "#<id>" or a bare id typed into the fallback box.
  const bare = text.replace(/^#/, '').trim();
  return bare.length > 0 ? bare : null;
}
