import jsQR from 'jsqr';
import type { QrJoinSource, CameraPermission } from './QrJoinSource';

/**
 * The real QrJoinSource: the device camera + a QR decoder.
 *
 * This is the only place in the app that touches getUserMedia, MediaStreamTrack,
 * or a QR decoder. Everything above it speaks the QrJoinSource interface.
 *
 * Two decode strategies sit behind that one interface:
 *   - the browser's native BarcodeDetector (fast) on Chrome/Edge/Android, and
 *   - jsQR (a JS decoder) as a fallback for browsers that lack it — notably
 *     iOS Safari, where getUserMedia works but BarcodeDetector doesn't.
 * So the camera scans on iPhones too; the UI above never knows which ran.
 */
export class CameraQrJoinSource implements QrJoinSource {
  private stream: MediaStream | null = null;
  private raf = 0;
  private canvas: HTMLCanvasElement | null = null;

  isSupported(): boolean {
    // A camera is enough — we always have jsQR to decode its frames.
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async getPermission(): Promise<CameraPermission> {
    try {
      // 'camera' isn't in TS's PermissionName union yet — cast it.
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return status.state as CameraPermission;
    } catch {
      // Firefox (and iOS Safari) don't expose the camera permission — that's
      // fine, we just prompt on start().
      return 'unknown';
    }
  }

  async start(video: HTMLVideoElement, onResult: (text: string) => void): Promise<void> {
    // Prefer the rear camera on phones. This is the call that triggers the
    // permission prompt, so callers must invoke start() from a user gesture.
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true'); // iOS: don't go fullscreen
    await video.play().catch(() => { /* autoplay may resolve late; loop still runs */ });

    // Pick the decode strategy once: native detector if present, else jsQR.
    const detector =
      typeof BarcodeDetector !== 'undefined' ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    const decodeFrame: () => Promise<string | null> | string | null = detector
      ? async () => {
          const codes = await detector.detect(video);
          return codes.length > 0 ? codes[0].rawValue : null;
        }
      : () => this.decodeWithJsQr(video);

    let done = false;
    const scan = async () => {
      if (done) return;
      try {
        const value = await decodeFrame();
        if (value) {
          done = true;
          onResult(value);
          return; // caller decides whether to stop(); we stop scanning either way
        }
      } catch {
        /* a transient detect() failure — keep trying on the next frame */
      }
      this.raf = requestAnimationFrame(scan);
    };
    this.raf = requestAnimationFrame(scan);
  }

  /** Decode the current video frame with jsQR by way of an offscreen canvas. */
  private decodeWithJsQr(video: HTMLVideoElement): string | null {
    if (!video.videoWidth || !video.videoHeight) return null; // metadata not ready yet
    if (!this.canvas) this.canvas = document.createElement('canvas');
    const canvas = this.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
    return result?.data ?? null;
  }

  stop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    // Release the camera so the indicator light turns off.
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.canvas = null;
  }
}
