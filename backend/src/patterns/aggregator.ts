import { TallyStrategy, SumStrategy } from './tallyStrategy';

/**
 * Aggregator (EIP)
 *
 * Collects individual vote messages correlated by pollId and combines them
 * into a running tally. Emits an updated result object on every new vote.
 *
 * Three knobs:
 *   Correlation  — by pollId
 *   Completeness — emit on every new message (running total, not final)
 *   Strategy     — how counts are combined, supplied by an injected
 *                  TallyStrategy (GoF Strategy). Defaults to SumStrategy.
 */

export interface VoteMessage {
  pollId: string;
  optionIndex: number;
  votedAt: string;
}

export interface Tally {
  pollId: string;
  counts: number[];   // index matches poll option index
  total: number;
}

// In-memory store — rehydrated from the append-only votes table on startup.
const tallies = new Map<string, number[]>();

// GoF Strategy — the combination algorithm is swappable without touching
// the Aggregator. Same interface idea as the Sprint 1 LLM transport Strategy.
let strategy: TallyStrategy = SumStrategy;

export function setTallyStrategy(s: TallyStrategy): void {
  strategy = s;
}

export function initTally(pollId: string, optionCount: number): void {
  tallies.set(pollId, new Array(optionCount).fill(0));
}

// Replace a poll's counts wholesale — used when rehydrating from the audit trail.
export function restoreTally(pollId: string, counts: number[]): void {
  tallies.set(pollId, [...counts]);
}

export function aggregate(vote: VoteMessage): Tally {
  const counts = tallies.get(vote.pollId);
  if (!counts) throw new Error(`No tally initialised for poll ${vote.pollId}`);

  const next = strategy.combine(counts, vote);
  tallies.set(vote.pollId, next);

  return {
    pollId: vote.pollId,
    counts: [...next],
    total: next.reduce((a, b) => a + b, 0),
  };
}

export function getTally(pollId: string): Tally | null {
  const counts = tallies.get(pollId);
  if (!counts) return null;
  return { pollId, counts: [...counts], total: counts.reduce((a, b) => a + b, 0) };
}
