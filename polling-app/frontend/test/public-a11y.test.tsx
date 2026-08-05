import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import PublicPollView from '../src/components/PublicPollView';

const poll = { id: 'p1', question: 'Best language?', options: ['Rust', 'Go'], status: 'open' as const };

describe('PublicPollView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers selectable options and a Submit Vote button — not Close or Leave', () => {
    render(<PublicPollView poll={poll} status="open" onExit={() => {}} />);
    // Options are radios you can pick, not one-click vote buttons.
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Submit Vote' })).toBeTruthy();
    // A voter can't close the poll and there's no Leave button.
    expect(screen.queryByRole('button', { name: 'Close poll' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
  });

  it('requires a selection before the vote can be submitted', () => {
    render(<PublicPollView poll={poll} status="open" onExit={() => {}} />);
    const submit = screen.getByRole('button', { name: 'Submit Vote' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /rust/i }));
    expect(submit.disabled).toBe(false);
  });

  it('thanks the voter and links home after submitting', async () => {
    render(<PublicPollView poll={poll} status="open" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /go/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Vote' }));

    await waitFor(() => expect(screen.getByText(/thank you for voting/i)).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/polls/p1/vote', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: /back to quorum home/i })).toBeTruthy();
  });

  it('has no detectable WCAG violations', async () => {
    const { container } = render(<PublicPollView poll={poll} status="open" onExit={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
