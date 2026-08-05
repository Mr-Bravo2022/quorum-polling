import { createMachine } from 'xstate';

/**
 * Poll lifecycle state chart — frontend mirror of the backend machine.
 *
 * States:  draft | open | closed
 * Events:  PUBLISH | CLOSE | SYNC
 * Guards:  hasOptions — can't publish a poll with fewer than 2 options
 * Actions: console.log on every entry (wired to UI transitions)
 *
 *   draft ---PUBLISH (guard: hasOptions)---> open
 *   open  ---CLOSE--------------------------> closed
 *
 * SYNC lets the UI snap the machine to a status pushed from the backend
 * over the Publish-Subscribe Channel, so two clients stay in agreement.
 */

export interface PollContext {
  pollId: string;
  optionCount: number;
}

export interface PollInput {
  pollId: string;
  optionCount: number;
}

export type PollStatus = 'draft' | 'open' | 'closed';

export type PollEvent =
  | { type: 'PUBLISH' }
  | { type: 'CLOSE' }
  | { type: 'SYNC'; status: PollStatus };

export const pollMachine = createMachine({
  id: 'poll',
  initial: 'draft',
  types: {} as { context: PollContext; events: PollEvent; input: PollInput },
  context: ({ input }) => ({
    pollId: input.pollId,
    optionCount: input.optionCount,
  }),
  // A status broadcast from the backend wins over local guesses — snap to it.
  on: {
    SYNC: [
      { target: '.draft', guard: ({ event }) => event.status === 'draft' },
      { target: '.open', guard: ({ event }) => event.status === 'open' },
      { target: '.closed', guard: ({ event }) => event.status === 'closed' },
    ],
  },
  states: {
    draft: {
      entry: () => console.log('[poll] draft'),
      on: { PUBLISH: { target: 'open', guard: ({ context }) => context.optionCount > 1 } },
    },
    open: {
      entry: () => console.log('[poll] open'),
      on: { CLOSE: 'closed' },
    },
    closed: {
      entry: () => console.log('[poll] closed'),
    },
  },
});
