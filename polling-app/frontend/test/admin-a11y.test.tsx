import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

// The view subscribes to MQTT on mount — stub it so it renders without a broker.
vi.mock('../src/mqtt/client', () => ({ subscribeToPoll: () => () => {} }));

import AdminPollView from '../src/components/AdminPollView';

const poll = { id: 'p1', question: 'Best language?', options: ['Rust', 'Go'], status: 'open' };

describe('AdminPollView', () => {
  it('lets the owner manage and watch — but never vote', () => {
    render(<AdminPollView poll={poll} status="open" onBack={() => {}} />);
    // Manage + navigate controls are present...
    expect(screen.getByRole('button', { name: /back to profile/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close poll' })).toBeTruthy();
    // ...but there are no vote buttons and no "Leave".
    expect(screen.queryByRole('button', { name: /vote for/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
  });

  it('calls back to the profile from the top control', () => {
    const onBack = vi.fn();
    render(<AdminPollView poll={poll} status="open" onBack={onBack} />);
    screen.getByRole('button', { name: /back to profile/i }).click();
    expect(onBack).toHaveBeenCalled();
  });

  it('has no detectable WCAG violations', async () => {
    const { container } = render(<AdminPollView poll={poll} status="open" onBack={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
