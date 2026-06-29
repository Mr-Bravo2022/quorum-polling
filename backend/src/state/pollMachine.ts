import { createMachine } from 'xstate';

/**
 * Poll lifecycle state chart (GoF State / Perfect Framework workflow).
 *
 * States:     draft | open | closed
 * Events:     PUBLISH | CLOSE
 * Guards:     hasOptions — can't publish a poll with fewer than 2 options
 * Actions:    logged on entry to each state (audit trail hook point)
 *
 *   draft ---PUBLISH (guard: hasOptions)---> open
 *   open  ---CLOSE--------------------------> closed (final)
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
      entry: () => console.log('[poll] entered draft'),
      on: {
        PUBLISH: {
          target: 'open',
          guard: ({ context }) => context.optionCount > 1,
        },
      },
    },
    open: {
      entry: () => console.log('[poll] entered open — accepting votes'),
      on: {
        CLOSE: 'closed',
      },
    },
    closed: {
      // Terminal state — no outgoing transitions; voting has ended.
      entry: () => console.log('[poll] entered closed — voting ended'),
    },
  },
});
