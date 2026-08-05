import { useState } from 'react';
import type { Poll } from '../App';
import type { PollStatus } from '../state/pollMachine';
import QrCode from './QrCode';

interface Props {
  poll: Poll;
  status: PollStatus;
  onExit: () => void;   // leave the poll (back to the landing page)
}

/**
 * The audience view, shown to anyone who opens a poll's share URL. Unlike the
 * admin, a voter cannot close the poll. They pick an option — and may change it
 * — then commit with "Submit Vote". After voting we thank them and point them
 * back to the landing page (they aren't signed in).
 */
export default function PublicPollView({ poll, status, onExit }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted]       = useState(false);
  const [busy, setBusy]         = useState(false);
  const [copied, setCopied]     = useState(false);

  const shareUrl = `${window.location.origin}#${poll.id}`;

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function submitVote() {
    if (selected === null || busy) return;
    setBusy(true);
    await fetch(`/api/polls/${poll.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex: selected }),
    });
    setBusy(false);
    setVoted(true);
  }

  // After voting: a thank-you with a way back to the public landing page.
  if (voted) {
    return (
      <section className="card thank-you" aria-label="Thank you for voting">
        <div className="thank-emoji" aria-hidden="true">🎉</div>
        <h2 className="card-title">Thank you for voting!</h2>
        <p className="thank-sub">Your response has been recorded. Results stay with the presenter.</p>
        <div className="actions">
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Back to Quorum home
          </button>
          <span className="spacer" />
        </div>
      </section>
    );
  }

  // A voter can only reach an open poll; guard the rare draft/closed race.
  if (status !== 'open') {
    return (
      <section className="card" aria-label={`Poll: ${poll.question}`}>
        <h2 className="poll-question">{poll.question}</h2>
        <p className="note">This poll isn’t open for voting right now.</p>
        <div className="actions">
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onExit}>Back to home</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" aria-label={`Poll: ${poll.question}`}>
      <h2 className="poll-question">{poll.question}</h2>
      <span className="pill pill-open"><span aria-hidden="true">● </span>Open for voting</span>

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

      {/* Selectable options — a single-choice radio group. Picking one only
          updates the local selection; nothing is sent until "Submit Vote". */}
      <div className="vote-list" role="radiogroup" aria-label={`Choose your answer for: ${poll.question}`}>
        {poll.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected === i}
            className={`vote-option${selected === i ? ' selected' : ''}`}
            onClick={() => setSelected(i)}
          >
            <span className="opt-radio" aria-hidden="true" />
            <span className="opt-label">{opt}</span>
          </button>
        ))}
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={submitVote}
          disabled={selected === null || busy}
        >
          {busy ? 'Submitting…' : 'Submit Vote'}
        </button>
      </div>
    </section>
  );
}
