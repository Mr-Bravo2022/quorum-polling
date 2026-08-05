import type { VoteMessage } from './aggregator';

/**
 * GoF Strategy
 *
 * Encapsulates *how* a stream of votes is folded into per-option counts so the
 * Aggregator stays agnostic to the algorithm. Swap the strategy and the
 * Aggregator's correlation/completeness logic is untouched — the same shape of
 * Strategy used for the Sprint 1 LLM transport.
 */
export interface TallyStrategy {
  readonly name: string;
  /** Return the next counts array given the current counts and a new vote. */
  combine(counts: number[], vote: VoteMessage): number[];
}

/** One vote, one count. The default tallying behaviour for a poll. */
export const SumStrategy: TallyStrategy = {
  name: 'sum',
  combine(counts, vote) {
    const next = [...counts];
    next[vote.optionIndex] += 1;
    return next;
  },
};
