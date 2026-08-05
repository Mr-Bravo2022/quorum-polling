import { useEffect, useState } from 'react';
import type { Poll } from '../App';
import type { PollStatus } from '../state/pollMachine';
import { subscribeToPoll } from '../mqtt/client';
import QrCode from './QrCode';

interface Props {
  poll: Poll;
  status: PollStatus;   // 'draft' | 'open' here (closed is handled by ResultsView)
  onBack: () => void;   // return to the Profile dashboard
}

interface Tally {
  counts: number[];
  total: number;
}

/**
 * The poll owner's view. Unlike the public view, the admin cannot vote — they
 * *watch* the results roll in live and control the poll's lifecycle (open a
 * draft, close an open poll) and share it. There is no "Leave" here; the way
 * out is "Back to Profile" at the top.
 */
export default function AdminPollView({ poll, status, onBack }: Props) {
  const [tally, setTally]   = useState<Tally>({ counts: poll.options.map(() => 0), total: 0 });
  const [busy, setBusy]     = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}#${poll.id}`;

  useEffect(() => {
    // Watch live results over the Publish-Subscribe Channel (MQTT).
    const unsub = subscribeToPoll(poll.id, 'results', (payload) => {
      setTally(payload as Tally);
    });
    return unsub;
  }, [poll.id]);

  async function post(path: string) {
    setBusy(true);
    await fetch(`/api/polls/${poll.id}/${path}`, { method: 'POST' });
    setBusy(false);
    // The backend broadcasts the new status; PollSession's machine SYNCs and
    // re-renders (e.g. into the results view once closed).
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const pct = (i: number) => (tally.total > 0 ? Math.round((tally.counts[i] / tally.total) * 100) : 0);

  return (
    <section className="card" aria-label={`Manage poll: ${poll.question}`}>
      <div className="admin-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back to Profile
        </button>
        <span className="pill pill-admin">Admin view</span>
      </div>

      <h2 className="poll-question">{poll.question}</h2>
      <span className={`pill ${status === 'open' ? 'pill-open' : 'pill-draft'}`}>
        {status === 'open'
          ? (<><span aria-hidden="true">● </span>Open for voting</>)
          : 'Draft'}
      </span>

      {/* Copy feedback, announced politely to screen readers. */}
      <div className="sr-only" role="status" aria-live="polite">
        {copied ? 'Share link copied to clipboard.' : ''}
      </div>

      <div className="share-row">
        <span>Share</span>
        <code>{shareUrl}</code>
        <button className="copy-btn" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>

      <div className="join-qr">
        <QrCode value={shareUrl} label="QR code — scan with a phone camera to join this poll" />
        <p className="qr-hint">Point a phone camera here to join &amp; vote</p>
      </div>

      <p className="stat-total">Total votes <b>{tally.total}</b></p>

      {/* Live results the admin watches — read-only, no voting. The tally is
          also announced as text for screen-reader users. */}
      <div className="sr-only" role="status" aria-live="polite">
        {tally.total === 0
          ? 'No votes yet.'
          : `${tally.total} total vote${tally.total === 1 ? '' : 's'}.`}
      </div>
      <ol className="results-list" aria-label="Live results">
        {poll.options.map((opt, i) => (
          <li key={i} className="result-row">
            <div className="result-head">
              <span className="name">{opt}</span>
              <span className="pct">{pct(i)}%</span>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${pct(i)}%` }} />
            </div>
            <div className="sub">{tally.counts[i] ?? 0} vote{(tally.counts[i] ?? 0) === 1 ? '' : 's'}</div>
          </li>
        ))}
      </ol>

      <div className="actions">
        {status === 'draft' && (
          <button className="btn btn-primary" onClick={() => post('publish')} disabled={busy}>
            Open poll
          </button>
        )}
        {status === 'open' && (
          <button className="btn btn-secondary" onClick={() => post('close')} disabled={busy}>
            {busy ? 'Closing…' : 'Close poll'}
          </button>
        )}
      </div>
    </section>
  );
}
