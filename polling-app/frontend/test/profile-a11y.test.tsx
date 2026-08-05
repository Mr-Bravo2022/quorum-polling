import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';

// Profile subscribes to MQTT for live updates — stub it so tests run without a broker.
vi.mock('../src/mqtt/client', () => ({ subscribeToPoll: () => () => {} }));

import Profile from '../src/components/Profile';
import { addPoll } from '../src/polls/store';

const user = { name: 'Juan' };

// Profile asks the backend for each poll's live status AND its vote tally.
// Serve the poll object for /api/polls/:id and the results rows for /results.
function stubFetch(status = 'open') {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const body = String(url).endsWith('/results')
      ? [[0, 2], [1, 3]]                                                   // 5 total votes
      : { id: String(url).split('/').pop(), question: 'Q?', options: ['a', 'b'], status };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }));
}

describe('Profile', () => {
  beforeEach(() => {
    localStorage.clear();
    stubFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('greets the user and offers to create a poll (empty state)', async () => {
    const { container } = render(
      <Profile user={user} onOpenPoll={() => {}} onCreated={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: /welcome, juan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Create a poll' })).toBeTruthy();
    expect(screen.getByText(/no polls yet/i)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lists my polls with their live status and a way to manage each', async () => {
    addPoll({ id: 'p1', question: 'Lunch spot?' });
    const onOpenPoll = vi.fn();
    const { container } = render(
      <Profile user={user} onOpenPoll={onOpenPoll} onCreated={() => {}} />,
    );

    expect(screen.getByText('Lunch spot?')).toBeTruthy();
    // Status + vote count arrive asynchronously from the (stubbed) backend.
    await waitFor(() => expect(screen.getByText('Open')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('5 votes')).toBeTruthy());
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Open poll: Lunch spot?' }));
    expect(onOpenPoll).toHaveBeenCalledWith('p1');
  });

  it('closes an open poll from the row', async () => {
    addPoll({ id: 'p1', question: 'Lunch spot?' });
    render(<Profile user={user} onOpenPoll={() => {}} onCreated={() => {}} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close poll: Lunch spot?' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Close poll: Lunch spot?' }));

    // Optimistic: the pill flips to Closed and the close endpoint is hit.
    await waitFor(() => expect(screen.getByText('Closed')).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/polls/p1/close', expect.objectContaining({ method: 'POST' }));
  });

  it('deletes a poll after confirming in an accessible dialog', async () => {
    addPoll({ id: 'p1', question: 'Lunch spot?' });
    const { container } = render(<Profile user={user} onOpenPoll={() => {}} onCreated={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete poll: Lunch spot?' }));

    // A confirmation dialog appears, with an accessible name, and passes axe.
    const dialog = screen.getByRole('dialog', { name: /delete this poll/i });
    expect(dialog).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: /close & delete/i }));

    // The poll is removed from the list and the backend delete is called.
    await waitFor(() => expect(screen.getByText(/no polls yet/i)).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/polls/p1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('lets an unavailable poll be deleted but not opened', async () => {
    addPoll({ id: 'gone', question: 'Old poll' });
    // The poll no longer exists on the backend → GET /:id fails.
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'DELETE' || String(url).endsWith('/close')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.reject() } as Response);
    }));
    render(<Profile user={user} onOpenPoll={() => {}} onCreated={() => {}} />);

    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Open poll: Old poll' }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByRole('button', { name: 'Delete poll: Old poll' })).toBeTruthy();
  });

  it('switches to the create-poll form and back', () => {
    render(<Profile user={user} onOpenPoll={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Create a poll' }));
    expect(screen.getByText('Create a poll')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back to my polls/i }));
    expect(screen.getByRole('heading', { name: /welcome, juan/i })).toBeTruthy();
  });
});
