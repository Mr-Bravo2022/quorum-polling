import { useEffect, useMemo, useRef, useState } from 'react';
import { type QrJoinSource, extractPollId } from '../qr/QrJoinSource';
import { CameraQrJoinSource } from '../qr/CameraQrJoinSource';
import { reportMetric } from '../metrics';

interface Props {
  /** Join a poll by id (audience/public). Rejects if no such poll exists. */
  onJoin: (pollId: string) => Promise<void>;
  /** Close the scanner and return to the landing page. */
  onCancel: () => void;
  /** The QR source. Defaults to the real camera; tests inject a fake. */
  source?: QrJoinSource;
}

type Phase = 'idle' | 'scanning' | 'joining';

/**
 * "Scan to join" UI. Talks only to the QrJoinSource Adapter — it never touches
 * the camera APIs itself. Permissions-first: the camera is only opened when the
 * user taps "Start camera". A manual code box is always available as a fallback
 * for when the camera is blocked or unsupported.
 */
export default function ScanToJoin({ onJoin, onCancel, source }: Props) {
  const src = useMemo(() => source ?? new CameraQrJoinSource(), [source]);
  const supported = useMemo(() => src.isSupported(), [src]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase]     = useState<Phase>('idle');
  const [error, setError]     = useState<string | null>(null);
  const [manual, setManual]   = useState('');

  // Always release the camera when the scanner unmounts.
  useEffect(() => () => src.stop(), [src]);

  async function join(id: string) {
    setPhase('joining');
    setError(null);
    try {
      await onJoin(id);
      // On success App swaps to the poll view and this component unmounts.
    } catch {
      setPhase('idle');
      setError('We couldn’t find a poll for that code. Check it and try again.');
    }
  }

  function handleResult(text: string) {
    src.stop();
    const id = extractPollId(text);
    if (!id) {
      setPhase('idle');
      setError('That QR code isn’t a Quorum poll link. Try again or enter the code.');
      return;
    }
    join(id);
  }

  async function startCamera() {
    setError(null);
    setPhase('scanning');
    try {
      // videoRef is always mounted (hidden when idle), so it's available here
      // within the click gesture that the camera prompt requires.
      if (!videoRef.current) throw new Error('no video element');
      await src.start(videoRef.current, handleResult);
    } catch {
      setPhase('idle');
      setError('Camera access was blocked. You can type the poll code instead.');
      reportMetric('camera_fallback');   // camera denied → manual fallback
    }
  }

  function stopCamera() {
    src.stop();
    setPhase('idle');
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const id = extractPollId(manual);
    if (!id) {
      setError('Enter a poll code to join.');
      return;
    }
    join(id);
  }

  function cancel() {
    src.stop();
    onCancel();
  }

  return (
    <section className="card scanner" aria-label="Scan to join a poll">
      <div className="admin-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>
          ← Back
        </button>
        <span className="pill pill-admin">Join a poll</span>
      </div>

      <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>Scan to join</h3>

      {/* Live camera. Kept mounted (just hidden when idle) so the ref exists at
          click time and getUserMedia runs inside the user gesture. */}
      <div className={`scanner-stage${phase === 'scanning' ? '' : ' is-hidden'}`}>
        <video
          ref={videoRef}
          className="scanner-video"
          muted
          playsInline
          aria-label="Camera preview — point it at a poll's QR code"
        />
        <div className="scanner-reticle" aria-hidden="true" />
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {phase === 'scanning' ? 'Camera active. Point it at a poll’s QR code.' : ''}
        {phase === 'joining' ? 'Joining poll…' : ''}
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Camera controls */}
      {phase === 'scanning' ? (
        <div className="actions">
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={stopCamera}>
            Stop camera
          </button>
        </div>
      ) : (
        <>
          {supported ? (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={startCamera}
              disabled={phase === 'joining'}
            >
              📷 Start camera
            </button>
          ) : (
            <p className="note">
              This browser can’t scan with the camera. Enter the poll code below to join.
            </p>
          )}

          {/* Manual fallback — always available. */}
          <form className="scanner-manual" onSubmit={submitManual}>
            <label className="label" htmlFor="poll-code">Or enter a poll code</label>
            <div className="scanner-manual-row">
              <input
                id="poll-code"
                className="input"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="e.g. 6cd1aad2-… or the full link"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-secondary" disabled={phase === 'joining'}>
                {phase === 'joining' ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
