import { useState } from 'react';
import { signIn, type User } from '../auth/session';
import ScanToJoin from './ScanToJoin';

interface Props {
  /** Called once the visitor has "signed in" (simulated). */
  onSignedIn: (user: User) => void;
  /** Join a poll by id as an audience member (from the QR scanner). */
  onJoinPoll: (pollId: string) => Promise<void>;
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'Live results',
    body: 'Votes appear the instant they’re cast, streamed to every screen over a real-time channel.',
  },
  {
    icon: '📷',
    title: 'Join by QR',
    body: 'Your audience scans a code with their phone camera — no app to install, no account to make.',
  },
  {
    icon: '♿',
    title: 'Accessible by design',
    body: 'Built to WCAG 2.1 AA, so it works with screen readers, keyboards, and high-contrast displays.',
  },
  {
    icon: '📊',
    title: 'Manage your polls',
    body: 'Create, open, and close every poll you run — all from one place, whenever you’re ready.',
  },
] as const;

/**
 * The public entry point for the whole site. Explains what Quorum is and why it
 * exists, then lets a visitor sign in (simulated — see auth/session) to start
 * creating polls. Audience members who arrive on a poll link (#<pollId>) never
 * see this page; they go straight to voting.
 */
export default function LandingPage({ onSignedIn, onJoinPoll }: Props) {
  // null = just browsing; 'signup'/'signin' open the auth panel; 'scan' opens
  // the in-app QR scanner.
  const [mode, setMode]   = useState<'signup' | 'signin' | 'scan' | null>(null);
  const [name, setName]   = useState('');
  const [error, setError] = useState<string | null>(null);

  function openAuth(next: 'signup' | 'signin') {
    setMode(next);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      // Announced to screen readers via role="alert" below.
      setError('Please enter your name to continue.');
      return;
    }
    setError(null);
    const user: User = { name: trimmed };
    signIn(user);
    onSignedIn(user);
  }

  return (
    <div className="landing">
      {/* ---- Hero: what we do + why ---- */}
      <section className="landing-hero" aria-labelledby="landing-title">
        <span className="landing-eyebrow">Real-time audience polling</span>
        <h2 id="landing-title" className="landing-title">
          Turn any audience into the conversation.
        </h2>
        <p className="landing-sub">
          Quorum runs live polls during your talks, classes, and meetings. Ask a
          question, share a QR code, and watch responses land on the screen in
          real time — because the best presentations aren’t one-way.
        </p>

        <div className="landing-cta">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => openAuth('signup')}
          >
            Create an account
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => openAuth('signin')}
          >
            Sign in
          </button>
        </div>

        {/* Audience members aren't signing in — they scan a poll to vote. */}
        <p className="landing-join">
          Here to vote?{' '}
          <button
            type="button"
            className="link-inline"
            onClick={() => { setMode('scan'); setError(null); }}
          >
            📷 Scan to join a poll
          </button>
        </p>
      </section>

      {/* ---- In-app QR scanner (Adapter-backed) ---- */}
      {mode === 'scan' && (
        <ScanToJoin onJoin={onJoinPoll} onCancel={() => setMode(null)} />
      )}

      {/* ---- Simulated sign-in panel (opens under the hero) ---- */}
      {(mode === 'signup' || mode === 'signin') && (
        <form className="card auth-card" onSubmit={handleSubmit} aria-label="Sign in to Quorum">
          <h3 className="card-title">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h3>
          <p className="auth-note">
            This is a demo sign-in — no password, no database. We just remember
            your name in this browser so you can manage the polls you create.
          </p>

          <div className="field">
            <label className="label" htmlFor="account-name">Your name</label>
            <input
              id="account-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Solis"
              autoFocus
            />
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}

          <div className="actions">
            <button type="submit" className="btn btn-primary btn-lg btn-block">
              {mode === 'signup' ? 'Create account & continue' : 'Sign in'}
            </button>
          </div>
        </form>
      )}

      {/* ---- Feature highlights ---- */}
      <section className="feature-grid" aria-label="What you can do with Quorum">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <span className="feature-icon" aria-hidden="true">{f.icon}</span>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-body">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
