import { useEffect, useState } from 'react';
import type { Poll } from '../App';
import { subscribeToPoll } from '../mqtt/client';

interface Props {
  poll: Poll;
  onLeave: () => void;
  /** Label for the exit button (varies by who's viewing). */
  exitLabel?: string;
}

interface Tally {
  counts: number[];
  total: number;
}

export default function ResultsView({ poll, onLeave, exitLabel = 'New poll' }: Props) {
  const [tally, setTally] = useState<Tally>({ counts: poll.options.map(() => 0), total: 0 });

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

  const winner = tally.total > 0 ? tally.counts.indexOf(Math.max(...tally.counts)) : -1;
  const pctOf = (i: number) => (tally.total > 0 ? Math.round((tally.counts[i] / tally.total) * 100) : 0);

  // Concise announcement for screen-reader users, spoken politely on each
  // update. WCAG: information is not conveyed by the bar colors alone — the
  // live region carries the same result as text.
  const liveSummary =
    tally.total === 0
      ? 'No votes yet.'
      : `${tally.total} total vote${tally.total === 1 ? '' : 's'}. ` +
        `Leading: ${poll.options[winner]}, ${tally.counts[winner]} ` +
        `vote${tally.counts[winner] === 1 ? '' : 's'}, ${pctOf(winner)} percent.`;

  return (
    <section className="card" aria-label={`Results for poll: ${poll.question}`}>
      <span className="pill pill-closed">Final results</span>
      <h2 className="poll-question" style={{ marginTop: '0.7rem' }}>{poll.question}</h2>
      <p className="stat-total">Total votes <b>{tally.total}</b></p>

      {/* Screen-reader live region: announces the running tally as it changes,
          without stealing focus. Sighted users read the bars below instead. */}
      <div className="sr-only" role="status" aria-live="polite">{liveSummary}</div>

      <ol className="results-list">
        {poll.options.map((opt, i) => {
          const pct = pctOf(i);
          const isWinner = i === winner;
          return (
            <li key={i} className={`result-row${isWinner ? ' winner' : ''}`}>
              <div className="result-head">
                <span className="name">
                  {opt}
                  {isWinner && <span className="crown" aria-hidden="true">🏆</span>}
                  {isWinner && <span className="sr-only"> (leading)</span>}
                </span>
                <span className="pct">{pct}%</span>
              </div>
              {/* Decorative — the percentage and count text convey the value. */}
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="sub">{tally.counts[i]} vote{tally.counts[i] === 1 ? '' : 's'}</div>
            </li>
          );
        })}
      </ol>

      <div className="actions">
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onLeave}>{exitLabel}</button>
      </div>
    </section>
  );
}
