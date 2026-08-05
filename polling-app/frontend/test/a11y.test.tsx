import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import CreatePoll from '../src/components/CreatePoll';

// The axe-core accessibility gate. Rendering a component and asserting zero
// violations is the CI-side half of the WCAG AA concern ("verification, not
// assertion"). Contrast (needs real layout) is covered by Lighthouse + the
// manual pass; this catches structural issues: missing labels, roles, names.
describe('accessibility gate (axe-core)', () => {
  it('CreatePoll renders and has no detectable WCAG violations', async () => {
    const { container } = render(<CreatePoll onCreated={() => {}} />);

    // Guard against a vacuous pass: if the component didn't actually render,
    // axe would trivially find nothing. Prove there is real content first.
    expect(screen.getByText('Create a poll')).toBeTruthy();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('associates every field with a label a screen reader can announce', () => {
    render(<CreatePoll onCreated={() => {}} />);
    // getByLabelText only finds inputs that have a real accessible label.
    expect(screen.getByLabelText('Question')).toBeTruthy();
    expect(screen.getByLabelText('Option 1')).toBeTruthy();
    expect(screen.getByLabelText('Option 2')).toBeTruthy();
  });
});
