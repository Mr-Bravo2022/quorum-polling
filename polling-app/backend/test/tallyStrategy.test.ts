import { describe, it, expect } from 'vitest';
import { SumStrategy } from '../src/patterns/tallyStrategy';
import type { VoteMessage } from '../src/patterns/aggregator';

// GoF Strategy — the swappable vote-combination algorithm the Aggregator uses.
describe('SumStrategy (GoF Strategy)', () => {
  const vote = (optionIndex: number): VoteMessage => ({
    pollId: 'p',
    optionIndex,
    votedAt: '2026-08-01T00:00:00.000Z',
  });

  it('is named "sum"', () => {
    expect(SumStrategy.name).toBe('sum');
  });

  it('increments the voted option by one', () => {
    expect(SumStrategy.combine([0, 0, 0], vote(1))).toEqual([0, 1, 0]);
  });

  it('accumulates across successive combines', () => {
    let counts = [0, 0];
    counts = SumStrategy.combine(counts, vote(0));
    counts = SumStrategy.combine(counts, vote(0));
    counts = SumStrategy.combine(counts, vote(1));
    expect(counts).toEqual([2, 1]);
  });

  it('does not mutate the input counts array (returns a new array)', () => {
    const input = [0, 0, 0];
    const output = SumStrategy.combine(input, vote(2));
    expect(input).toEqual([0, 0, 0]); // unchanged
    expect(output).not.toBe(input); // new reference
  });
});
