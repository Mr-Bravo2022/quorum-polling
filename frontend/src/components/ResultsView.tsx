import { useEffect, useState } from 'react';
import type { Poll } from '../App';
import type { PollStatus } from '../state/pollMachine';
import { subscribeToPoll } from '../mqtt/client';

interface Props {
  poll: Poll;
  status: PollStatus;        // 'closed' | 'results' here
  onLeave: () => void;
}

interface Tally {
  counts: number[];
  total: number;
}

export default function ResultsView({ poll, status, onLeave }: Props) {
  const [tally, setTally] = useState<Tally>({ counts: poll.options.map(() => 0), total: 0 });
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    // Rebuild the final tally from the audit trail (REST), then keep listening
    // for any late retained results over the Publish-Subscribe Channel.
    fetch(`/api/polls/${poll.id}/results`)
      .then((r) => r.json())
      .then((rows: [number, number][]) => {
        const counts = poll.options.map(() => 0);
        rows.forEach(([idx, count]) => { counts[idx] = count; });
        setTally({ counts, total: counts.reduce((a, b) => a + b, 0) });
      });

    const unsub = subscribeToPoll(poll.id, 'results', (payload) => {
      setTally(payload as Tally);
    });
    return unsub;
  }, [poll.id, poll.options]);

  async function send(path: string) {
    setBusy(true);
    await fetch(`/api/polls/${poll.id}/${path}`, { method: 'POST' });
    setBusy(false);
  }

  const winner = tally.total > 0 ? tally.counts.indexOf(Math.max(...tally.counts)) : -1;

  return (
    <div className="card">
      <span className="pill pill-closed">{status === 'results' ? 'Final results' : 'Closed'}</span>
      <h2 className="poll-question" style={{ marginTop: '0.7rem' }}>{poll.question}</h2>
      <p className="stat-total">Total votes <b>{tally.total}</b></p>

      {poll.options.map((opt, i) => {
        const pct = tally.total > 0 ? Math.round((tally.counts[i] / tally.total) * 100) : 0;
        const isWinner = i === winner;
        return (
          <div key={i} className={`result-row${isWinner ? ' winner' : ''}`}>
            <div className="result-head">
              <span className="name">{opt}{isWinner && <span className="crown">🏆</span>}</span>
              <span className="pct">{pct}%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="sub">{tally.counts[i]} vote{tally.counts[i] === 1 ? '' : 's'}</div>
          </div>
        );
      })}

      {/* Host controls — each fires a state-chart transition that the backend
          broadcasts to every client. */}
      <div className="actions">
        {status === 'closed' && (
          <button className="btn btn-primary" onClick={() => send('results')} disabled={busy}>
            Publish final results
          </button>
        )}
        {status === 'results' && (
          <button className="btn btn-secondary" onClick={() => send('reset')} disabled={busy}>
            Reset to draft
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onLeave}>New poll</button>
      </div>
    </div>
  );
}
