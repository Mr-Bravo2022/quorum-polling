import { useEffect, useState } from 'react';
import PollSession, { type PollRole } from './components/PollSession';
import LandingPage from './components/LandingPage';
import Profile from './components/Profile';
import Logo from './components/Logo';
import { getCurrentUser, signOut, type User } from './auth/session';
import { reportMetric } from './metrics';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  status: string;
}

export default function App() {
  const [poll, setPoll]           = useState<Poll | null>(null);
  const [pollRole, setPollRole]   = useState<PollRole>('public');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [user, setUser]           = useState<User | null>(() => getCurrentUser());

  // If we arrived on a poll link (#<pollId>), we're an audience member joining
  // to vote — skip the landing page and fetch the poll straight away.
  const [joining, setJoining] = useState(
    () => window.location.hash.replace(/^#/, '').trim().length > 0,
  );

  // Join an existing poll when its id rides in on the URL hash (#<pollId>).
  // This is what lets a second browser/client vote on the *same* poll.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '').trim();
    if (!id) return;
    fetch(`/api/polls/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Poll not found'))))
      .then((p: Poll) => { setPoll(p); setPollRole('public'); reportMetric('join_success'); })
      .catch((e: Error) => setJoinError(e.message))
      .finally(() => setJoining(false));
  }, []);

  // Created by the signed-in owner → open its admin view. We deliberately do NOT
  // put the id in the address bar: the owner's URL stays clean, and the shared
  // link (origin + #id, shown in the view) is what opens the public view.
  function onCreated(p: Poll) {
    setPoll(p);
    setPollRole('admin');
  }

  // Open one of my existing polls from the Profile page → admin view.
  function openPoll(id: string) {
    setJoinError(null);
    fetch(`/api/polls/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Poll not found'))))
      .then((p: Poll) => { setPoll(p); setPollRole('admin'); })
      .catch((e: Error) => setJoinError(e.message));
  }

  // Join a poll as an audience member (from the in-app QR scanner). Returns a
  // promise so the scanner can surface "no such poll" inline instead of
  // replacing the whole page. On success we drop into the public poll view.
  function joinPollAsAudience(id: string): Promise<void> {
    return fetch(`/api/polls/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Poll not found'))))
      .then((p: Poll) => { setPoll(p); setPollRole('public'); reportMetric('join_success'); });
  }

  function leave() {
    window.location.hash = '';
    setPoll(null);
    setPollRole('public');
    setJoinError(null);
  }

  function handleSignOut() {
    signOut();
    setUser(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <Logo size={40} className="brand-logo" />
        <div className="brand-text">
          <h1>Quorum</h1>
          <span>Real-time consensus</span>
        </div>

        {/* When signed in (and not inside a poll), show who you are + a way out.
            Otherwise keep the original Live badge. */}
        {user && !poll ? (
          <div className="account-chip">
            <span className="account-name">
              <span className="account-hi">Signed in as</span> {user.name}
            </span>
            <button type="button" className="link-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="live-badge"><span className="live-dot" /> Live</div>
        )}
      </header>

      {poll && <PollSession poll={poll} role={pollRole} onExit={leave} />}

      {!poll && joining && (
        <div className="card"><p className="note">Joining poll…</p></div>
      )}

      {!poll && !joining && joinError && (
        <div className="card"><p className="error-text">{joinError}</p></div>
      )}

      {!poll && !joining && !joinError && !user && (
        <LandingPage onSignedIn={setUser} onJoinPoll={joinPollAsAudience} />
      )}

      {!poll && !joining && !joinError && user && (
        <Profile user={user} onOpenPoll={openPoll} onCreated={onCreated} />
      )}

      <footer className="app-footer">
        Polls powered by <b>Quorum</b> · Real-time consensus platform
      </footer>
    </div>
  );
}
