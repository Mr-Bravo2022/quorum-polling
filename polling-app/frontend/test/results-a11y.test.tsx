import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';

// ResultsView subscribes to MQTT and fetches on mount — stub both so the
// component renders in isolation, with no broker or network.
vi.mock('../src/mqtt/client', () => ({
  subscribeToPoll: () => () => {},
}));

import ResultsView from '../src/components/ResultsView';

const poll = {
  id: 'p1',
  question: 'Best language?',
  options: ['Rust', 'TypeScript', 'Go'],
  status: 'closed',
};

beforeEach(() => {
  // GET /api/polls/:id/results  ->  [optionIndex, count][]
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([[0, 2], [1, 5], [2, 1]]) }),
  ) as unknown as typeof fetch;
});

describe('ResultsView accessibility', () => {
  it('exposes a polite live region that announces the leading option', async () => {
    render(<ResultsView poll={poll} onLeave={() => {}} />);

    const status = screen.getByRole('status');
    expect(status).toBeTruthy();

    // Once the fetch resolves (2/5/1), TypeScript leads with 5 votes.
    await waitFor(() => expect(status.textContent).toMatch(/Leading: TypeScript/));
    expect(status.textContent).toMatch(/8 total votes/);
  });

  it('has no detectable WCAG violations', async () => {
    const { container } = render(<ResultsView poll={poll} onLeave={() => {}} />);
    await waitFor(() => expect(screen.getByText('8')).toBeTruthy());

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
