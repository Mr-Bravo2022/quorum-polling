import { describe, it, expect, beforeEach } from 'vitest';
import * as metrics from '../src/observability/metrics';

// Observability — the metrics half (RED-method view served at GET /api/metrics).
describe('metrics (RED view)', () => {
  beforeEach(() => metrics._reset());

  it('counts votes and computes rate + average duration', () => {
    metrics.recordVote(5);
    metrics.recordVote(15);
    const snap = metrics.snapshot(2);

    expect(snap.gauges.votes_cast_total).toBe(2);
    expect(snap.rate.votes_per_min).toBe(2);            // both within the 60s window
    expect(snap.duration.vote_avg_ms).toBe(10);         // (5 + 15) / 2
    expect(snap.duration.vote_samples).toBe(2);
    expect(snap.gauges.polls_active).toBe(2);           // live gauge passed in
  });

  it('tracks errors and client-reported events', () => {
    metrics.incr('votes_rejected');
    metrics.incr('dead_letter', 2);
    metrics.recordClientEvent('join_success');
    metrics.recordClientEvent('join_success');
    metrics.recordClientEvent('camera_fallback');

    const snap = metrics.snapshot(0);
    expect(snap.errors.votes_rejected_total).toBe(1);
    expect(snap.errors.dead_letter_total).toBe(2);
    expect(snap.gauges.join_success_total).toBe(2);
    expect(snap.gauges.camera_fallback_total).toBe(1);
  });

  it('snapshot exposes the RED shape (rate / errors / duration + gauges)', () => {
    const snap = metrics.snapshot(0);
    expect(snap).toHaveProperty('rate');
    expect(snap).toHaveProperty('errors');
    expect(snap).toHaveProperty('duration');
    expect(snap).toHaveProperty('gauges');
    expect(Number.isNaN(Date.parse(snap.ts))).toBe(false);
  });
});
