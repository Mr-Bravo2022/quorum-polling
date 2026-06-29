import { useEffect, useState } from 'react';
import type { Poll } from '../App';
import type { PollStatus } from '../state/pollMachine';
import { subscribeToPoll } from '../mqtt/client';

interface Props {
  poll: Poll;
  status: PollStatus;        // 'draft' | 'open' here
  onLeave: () => void;
}

interface Tally {
  counts: number[];
  total: number;
}

export default function VotingView({ poll, status, onLeave }: Props) {
  const [tally, setTally] = useState<Tally>({ counts: poll.options.map(() => 0), total: 0 });
  const [voted, setVoted] = useState(false);
  const [busy, setBusy]   = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}#${poll.id}`;
  const canVote  = status === 'open';

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    // Subscribe to live results over the Publish-Subscribe Channel (MQTT).
    // Because the backend retains the results message, we get the current
    // tally immediately on subscribe even if we joined mid-poll.
    const unsub = subscribeToPoll(poll.id, 'results', (payload) => {
      setTally(payload as Tally);
    });
    return unsub;
  }, [poll.id]);

  async function vote(optionIndex: number) {
    if (voted || !canVote) return;
    await fetch(`/api/polls/${poll.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex }),
    });
    setVoted(true);
  }

  async function send(path: string) {
    setBusy(true);
    await fetch(`/api/polls/${poll.id}/${path}`, { method: 'POST' });
    setBusy(false);
    // No local navigation — the backend broadcasts the new status and
    // PollSession moves us (and every other client) to the next view.
  }

  return (
    <div className="card">
      <h2 className="poll-question">{poll.question}</h2>
      <span className={`pill ${status === 'open' ? 'pill-open' : 'pill-draft'}`}>
        {status === 'open' ? '● Open for voting' : 'Draft'}
      </span>

      <div className="share-row">
        <span>Share</span>
        <code>{shareUrl}</code>
        <button className="copy-btn" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>

      {status === 'draft' && (
        <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={() => send('publish')} disabled={busy}>
            Open poll
          </button>
        </div>
      )}

      <p className="stat-total">Total votes <b>{tally.total}</b></p>

      <div className="vote-list">
        {poll.options.map((opt, i) => (
          <button
            key={i}
            className="vote-option"
            onClick={() => vote(i)}
            disabled={voted || !canVote}
          >
            <span className="opt-label">{opt}</span>
            <span className="opt-count">{tally.counts[i] ?? 0}</span>
          </button>
        ))}
      </div>

      {voted && <p className="note note-success">✓ Vote recorded — results update live.</p>}

      <div className="actions">
        {status === 'open' && (
          <button className="btn btn-secondary" onClick={() => send('close')} disabled={busy}>
            {busy ? 'Closing…' : 'Close poll'}
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
      </div>
    </div>
  );
}
