import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pollMachine } from '../src/state/pollMachine';

// GoF State / poll lifecycle:  draft --PUBLISH(guard)--> open --CLOSE--> closed
const start = (optionCount: number) =>
  createActor(pollMachine, { input: { pollId: 'p1', optionCount } }).start();

describe('pollMachine (GoF State)', () => {
  it('starts in draft', () => {
    expect(start(3).getSnapshot().value).toBe('draft');
  });

  it('PUBLISH moves draft -> open when the poll has >1 option', () => {
    const actor = start(3);
    actor.send({ type: 'PUBLISH' });
    expect(actor.getSnapshot().value).toBe('open');
  });

  it('guard blocks PUBLISH when the poll has fewer than 2 options', () => {
    const actor = start(1);
    actor.send({ type: 'PUBLISH' });
    expect(actor.getSnapshot().value).toBe('draft'); // transition refused
  });

  it('CLOSE moves open -> closed', () => {
    const actor = start(2);
    actor.send({ type: 'PUBLISH' });
    actor.send({ type: 'CLOSE' });
    expect(actor.getSnapshot().value).toBe('closed');
  });

  it('closed is terminal — no further transitions', () => {
    const actor = start(2);
    actor.send({ type: 'PUBLISH' });
    actor.send({ type: 'CLOSE' });
    actor.send({ type: 'PUBLISH' }); // ignored
    expect(actor.getSnapshot().value).toBe('closed');
  });
});
