/**
 * In-process metrics — the "metrics" half of the Observability concern
 * (structured logs are the other half, in ./logger.ts).
 *
 * A small RED-method view (Rate / Errors / Duration) plus a few gauges, served
 * as JSON at GET /api/metrics. Kept in-memory and dependency-free: this resets
 * on restart, which is fine for a single-instance demo — the point is a live,
 * queryable metrics surface, not a time-series database.
 */

interface Counters {
  polls_created: number;
  polls_closed: number;
  polls_deleted: number;
  votes_cast: number;
  votes_rejected: number;   // Errors: votes to a non-open poll
  dead_letter: number;      // Errors: unroutable messages (Content-Based Router)
  join_success: number;     // client-reported: an audience member joined a poll
  camera_fallback: number;  // client-reported: camera denied → manual fallback
}

const counters: Counters = {
  polls_created: 0, polls_closed: 0, polls_deleted: 0,
  votes_cast: 0, votes_rejected: 0, dead_letter: 0,
  join_success: 0, camera_fallback: 0,
};

// Rolling window of recent vote timestamps (for Rate) and processing durations
// in ms (for Duration).
const voteTimes: number[] = [];
const voteDurations: number[] = [];
const WINDOW_MS = 60_000;
const MAX_DURATIONS = 200;

export type ClientMetric = 'join_success' | 'camera_fallback';

export function incr(name: keyof Counters, by = 1): void {
  counters[name] += by;
}

/** Record one processed vote: bumps the counter, the rate window, and duration. */
export function recordVote(durationMs: number): void {
  counters.votes_cast += 1;
  const now = Date.now();
  voteTimes.push(now);
  trimWindow(now);
  voteDurations.push(durationMs);
  if (voteDurations.length > MAX_DURATIONS) voteDurations.shift();
}

/** Record a client-side event (join success / camera fallback). */
export function recordClientEvent(type: ClientMetric): void {
  counters[type] += 1;
}

function trimWindow(now: number): void {
  const cutoff = now - WINDOW_MS;
  while (voteTimes.length && voteTimes[0] < cutoff) voteTimes.shift();
}

/** A point-in-time snapshot. `activePolls` is a live gauge passed in by caller. */
export function snapshot(activePolls: number) {
  const now = Date.now();
  trimWindow(now);
  const votesLastMin = voteTimes.length;
  const avgMs = voteDurations.length
    ? +(voteDurations.reduce((a, b) => a + b, 0) / voteDurations.length).toFixed(1)
    : 0;

  return {
    ts: new Date().toISOString(),
    rate: {
      votes_per_min: votesLastMin,
      votes_per_sec: +(votesLastMin / 60).toFixed(3),
      polls_created_total: counters.polls_created,
    },
    errors: {
      votes_rejected_total: counters.votes_rejected,
      dead_letter_total: counters.dead_letter,
    },
    duration: {
      vote_avg_ms: avgMs,
      vote_samples: voteDurations.length,
    },
    gauges: {
      polls_active: activePolls,
      polls_closed_total: counters.polls_closed,
      polls_deleted_total: counters.polls_deleted,
      votes_cast_total: counters.votes_cast,
      join_success_total: counters.join_success,
      camera_fallback_total: counters.camera_fallback,
    },
  };
}

/** Test/support helper — reset all state. */
export function _reset(): void {
  (Object.keys(counters) as (keyof Counters)[]).forEach((k) => { counters[k] = 0; });
  voteTimes.length = 0;
  voteDurations.length = 0;
}
