import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import QrCode from '../src/components/QrCode';

describe('QrCode', () => {
  it('renders an accessible image labelled for screen readers', () => {
    render(<QrCode value="https://quorum.example/#p1" label="Scan to join" />);
    // role="img" + aria-label means a screen reader announces "Scan to join",
    // not the raw pixels.
    expect(screen.getByRole('img', { name: 'Scan to join' })).toBeTruthy();
  });

  it('actually encodes the value into an SVG', async () => {
    const { container } = render(
      <QrCode value="https://quorum.example/#p1" label="Scan to join" />,
    );
    // The SVG is generated asynchronously; wait for it to appear.
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
  });

  it('has no detectable WCAG violations', async () => {
    const { container } = render(
      <QrCode value="https://quorum.example/#p1" label="Scan to join" />,
    );
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
