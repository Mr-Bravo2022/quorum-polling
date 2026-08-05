import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import LandingPage from '../src/components/LandingPage';
import { getCurrentUser } from '../src/auth/session';

describe('LandingPage', () => {
  beforeEach(() => {
    // Each test starts signed-out so the simulated session is deterministic.
    localStorage.clear();
  });

  it('explains what the product is and offers a way in', () => {
    render(<LandingPage onSignedIn={() => {}} onJoinPoll={async () => {}} />);
    // Real content is present (guards against a vacuous axe pass below).
    expect(screen.getByRole('heading', { name: /turn any audience/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('has no detectable WCAG violations (browsing and with the auth panel open)', async () => {
    const { container } = render(<LandingPage onSignedIn={() => {}} onJoinPoll={async () => {}} />);
    expect(await axe(container)).toHaveNoViolations();

    // Open the sign-in panel and re-check — the form must be accessible too.
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('signs the user in (simulated) and remembers them in the browser', () => {
    const onSignedIn = vi.fn();
    render(<LandingPage onSignedIn={onSignedIn} onJoinPoll={async () => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Juan  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account & continue' }));

    // Callback fires with the trimmed name...
    expect(onSignedIn).toHaveBeenCalledWith({ name: 'Juan' });
    // ...and the session is persisted for the "My Account" page to read back.
    expect(getCurrentUser()).toEqual({ name: 'Juan' });
  });

  it('refuses to sign in with an empty name and announces the error', () => {
    const onSignedIn = vi.fn();
    render(<LandingPage onSignedIn={onSignedIn} onJoinPoll={async () => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account & continue' }));

    expect(onSignedIn).not.toHaveBeenCalled();
    // role="alert" — screen readers announce the validation message.
    expect(screen.getByRole('alert').textContent).toMatch(/enter your name/i);
    expect(getCurrentUser()).toBeNull();
  });
});
