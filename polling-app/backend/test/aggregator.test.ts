import { describe, it, expect, afterEach } from 'vitest';
import {
  initTally,
  restoreTally,
  aggregate,
  getTally,
  setTallyStrategy,
  type VoteMessage,
  type Tally,
} from '../src/patterns/aggregator';
import { SumStrategy, type TallyStrategy } from '../src/patterns/tallyStrategy';

// Unique poll ids per test keep the module-level tally store from bleeding
// between cases (the Aggregator keeps an in-memory Map, rehydrated in prod).
let n = 0;
const freshPollId = () => `poll-${n++}`;
const vote = (pollId: string, optionIndex: number): VoteMessage => ({
  pollId,
  optionIndex,
  votedAt: '2026-08-01T00:00:00.000Z',
});

// The tally strategy is module-global; restore the default after any swap.
afterEach(() => setTallyStrategy(SumStrategy));

describe('Aggregator (EIP)', () => {
  it('emits a running tally with correct counts and total on each vote', () => {
    const id = freshPollId();
    initTally(id, 3);

    const first: Tally = aggregate(vote(id, 0));
    expect(first.counts).toEqual([1, 0, 0]);
    expect(first.total).toBe(1);

    const second = aggregate(vote(id, 2));
    expect(second.counts).toEqual([1, 0, 1]);
    expect(second.total).toBe(2);
  });

  it('correlates by pollId — votes never cross between polls', () => {
    const a = freshPollId();
    const b = freshPollId();
    initTally(a, 2);
    initTally(b, 2);

    aggregate(vote(a, 0));
    aggregate(vote(a, 0));
    aggregate(vote(b, 1));

    expect(getTally(a)?.counts).toEqual([2, 0]);
    expect(getTally(b)?.counts).toEqual([0, 1]);
  });

  it('throws when aggregating a vote for an uninitialised poll', () => {
    expect(() => aggregate(vote('never-initialised', 0))).toThrow();
  });

  it('returns null from getTally for an unknown poll', () => {
    expect(getTally('unknown')).toBeNull();
  });

  it('restoreTally replaces counts wholesale (audit-trail rehydration)', () => {
    const id = freshPollId();
    initTally(id, 3);
    restoreTally(id, [5, 2, 9]);
    expect(getTally(id)?.counts).toEqual([5, 2, 9]);
    expect(getTally(id)?.total).toBe(16);
  });

  it('honours an injected TallyStrategy (Strategy is swappable)', () => {
    // A weighted strategy: every vote counts double.
    const DoubleStrategy: TallyStrategy = {
      name: 'double',
      combine(counts, v) {
        const next = [...counts];
        next[v.optionIndex] += 2;
        return next;
      },
    };
    setTallyStrategy(DoubleStrategy);

    const id = freshPollId();
    initTally(id, 2);
    expect(aggregate(vote(id, 0)).counts).toEqual([2, 0]);
  });
});
