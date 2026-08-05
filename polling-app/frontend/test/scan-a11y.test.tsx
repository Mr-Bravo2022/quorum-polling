import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import ScanToJoin from '../src/components/ScanToJoin';
import { extractPollId, type QrJoinSource, type CameraPermission } from '../src/qr/QrJoinSource';

/** A fake QrJoinSource so we can test the UI + Adapter seam without a camera. */
class FakeSource implements QrJoinSource {
  started = false;
  stopped = false;
  private cb?: (t: string) => void;
  constructor(private supported = true, private denyStart = false) {}
  isSupported() { return this.supported; }
  async getPermission(): Promise<CameraPermission> { return 'prompt'; }
  async start(_v: HTMLVideoElement, onResult: (t: string) => void) {
    if (this.denyStart) throw new Error('denied');
    this.started = true;
    this.cb = onResult;
  }
  stop() { this.stopped = true; }
  /** Simulate a QR code coming into view. */
  emit(text: string) { this.cb?.(text); }
}

describe('extractPollId', () => {
  it('reads the poll id from a share URL, a #hash, or a bare id', () => {
    expect(extractPollId('https://quorum.example/#abc123')).toBe('abc123');
    expect(extractPollId('#abc123')).toBe('abc123');
    expect(extractPollId('abc123')).toBe('abc123');
    expect(extractPollId('')).toBeNull();
    expect(extractPollId('   ')).toBeNull();
  });
});

describe('ScanToJoin', () => {
  it('starts the camera on a user gesture and joins the decoded poll', async () => {
    const source = new FakeSource(true);
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<ScanToJoin source={source} onJoin={onJoin} onCancel={() => {}} />);

    // Permissions-first: nothing started until the user clicks.
    expect(source.started).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /start camera/i }));
    await waitFor(() => expect(source.started).toBe(true));

    // A QR comes into view → we join and release the camera.
    source.emit('https://quorum.example/#poll-42');
    await waitFor(() => expect(onJoin).toHaveBeenCalledWith('poll-42'));
    expect(source.stopped).toBe(true);
  });

  it('falls back to manual entry when the camera is unsupported', () => {
    const source = new FakeSource(false);           // e.g. Safari / Firefox
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<ScanToJoin source={source} onJoin={onJoin} onCancel={() => {}} />);

    // No camera button; the manual code box is offered instead.
    expect(screen.queryByRole('button', { name: /start camera/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/enter a poll code/i), { target: { value: 'poll-7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoin).toHaveBeenCalledWith('poll-7');
  });

  it('shows an error (and keeps the fallback) when camera access is denied', async () => {
    const source = new FakeSource(true, /* denyStart */ true);
    render(<ScanToJoin source={source} onJoin={vi.fn()} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /start camera/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/blocked/i));
    // Manual entry is still available as a way in.
    expect(screen.getByLabelText(/enter a poll code/i)).toBeTruthy();
  });

  it('has no detectable WCAG violations', async () => {
    const source = new FakeSource(true);
    const { container } = render(<ScanToJoin source={source} onJoin={vi.fn()} onCancel={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
