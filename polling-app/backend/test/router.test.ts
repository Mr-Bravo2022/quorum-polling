import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerRoute, route, type IncomingMessage } from '../src/patterns/router';

afterEach(() => vi.restoreAllMocks());

describe('Content-Based Router (EIP)', () => {
  it('routes a message to the handler registered for its type', async () => {
    const voteHandler = vi.fn();
    registerRoute('vote', voteHandler);

    const msg: IncomingMessage = { type: 'vote', payload: { optionIndex: 1 } };
    await route(msg);

    expect(voteHandler).toHaveBeenCalledOnce();
    expect(voteHandler).toHaveBeenCalledWith({ optionIndex: 1 });
  });

  it('routes different content to different handlers', async () => {
    const voteHandler = vi.fn();
    const statusHandler = vi.fn();
    registerRoute('vote', voteHandler);
    registerRoute('status-change', statusHandler);

    await route({ type: 'status-change', payload: { to: 'closed' } });

    expect(statusHandler).toHaveBeenCalledOnce();
    expect(voteHandler).not.toHaveBeenCalled();
  });

  it('awaits async handlers', async () => {
    const order: string[] = [];
    registerRoute('vote', async () => {
      await Promise.resolve();
      order.push('handled');
    });

    await route({ type: 'vote', payload: null });
    order.push('after');

    expect(order).toEqual(['handled', 'after']);
  });

  it('dead-letters an unroutable message type instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cast: exercising the unknown-type branch the router guards against.
    await route({ type: 'nope' as any, payload: {} });
    expect(warn).toHaveBeenCalled();
  });
});
