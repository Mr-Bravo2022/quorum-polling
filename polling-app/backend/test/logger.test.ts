import { describe, it, expect, vi, afterEach } from 'vitest';
import { log } from '../src/observability/logger';

// The Observability concern: structured, greppable JSON logs keyed by poll id.
describe('structured logger (Observability)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits one JSON object per line with ts, level, event and fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('vote.cast', { pollId: 'p1', optionIndex: 2, total: 5 });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line); // must be valid JSON — throws otherwise
    expect(parsed).toMatchObject({
      level: 'info',
      event: 'vote.cast',
      pollId: 'p1',
      optionIndex: 2,
      total: 5,
    });
    // A real, parseable timestamp.
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  it('routes warn and error to the matching console stream', () => {
    const warn  = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    log.warn('vote.rejected', { pollId: 'p1', reason: 'poll-not-open' });
    log.error('mqtt.error', { error: 'boom' });

    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      level: 'warn', event: 'vote.rejected', pollId: 'p1',
    });
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({
      level: 'error', event: 'mqtt.error', error: 'boom',
    });
  });

  it('carries pollId as a correlation id you can filter the stream by', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('poll.status_changed', { pollId: 'abc', from: 'draft', to: 'open' });
    expect(spy.mock.calls[0][0]).toContain('"pollId":"abc"');
  });
});
