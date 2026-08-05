import { createMachine } from 'xstate';

/**
 * Poll lifecycle state chart (GoF State / Perfect Framework workflow).
 *
 * States:     draft | open | closed
 * Events:     PUBLISH | CLOSE
 * Guards:     hasOptions — can't publish a poll with fewer than 2 options
 *
 *   draft ---PUBLISH (guard: hasOptions)---> open
 *   open  ---CLOSE--------------------------> closed (final)
 *
 * Status transitions are recorded by the route layer via the structured logger
 * (`poll.status_changed`, keyed by poll id) — the Observability concern.
 */

export interface PollContext {
  pollId: string;
  optionCount: number;
}

export interface PollInput {
  pollId: string;
  optionCount: number;
}

export type PollEvent =
  | { type: 'PUBLISH' }
  | { type: 'CLOSE' };

export const pollMachine = createMachine({
  id: 'poll',
  initial: 'draft',
  types: {} as { context: PollContext; events: PollEvent; input: PollInput },
  context: ({ input }) => ({
    pollId: input.pollId,
    optionCount: input.optionCount,
  }),
  states: {
    draft: {
      on: {
        PUBLISH: {
          target: 'open',
          guard: ({ context }) => context.optionCount > 1,
        },
      },
    },
    open: {
      on: {
        CLOSE: 'closed',
      },
    },
    // Terminal state — no outgoing transitions; voting has ended.
    closed: {},
  },
});
