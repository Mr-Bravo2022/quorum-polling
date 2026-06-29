import { useEffect, useState } from 'react';
import CreatePoll from './components/CreatePoll';
import PollSession from './components/PollSession';
import Logo from './components/Logo';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  status: string;
}

export default function App() {
  const [poll, setPoll]           = useState<Poll | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Join an existing poll when its id rides in on the URL hash (#<pollId>).
  // This is what lets a second browser/client vote on the *same* poll.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '').trim();
    if (!id) return;
    fetch(`/api/polls/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Poll not found'))))
      .then((p: Poll) => setPoll(p))
      .catch((e: Error) => setJoinError(e.message));
  }, []);

  function onCreated(p: Poll) {
    window.location.hash = p.id;   // make the poll shareable
    setPoll(p);
  }

  function leave() {
    window.location.hash = '';
    setPoll(null);
    setJoinError(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <Logo size={40} className="brand-logo" />
        <div className="brand-text">
          <h1>Quorum</h1>
          <span>Real-time consensus</span>
        </div>
        <div className="live-badge"><span className="live-dot" /> Live</div>
      </header>

      {!poll && <CreatePoll onCreated={onCreated} />}
      {!poll && joinError && (
        <div className="card"><p className="error-text">{joinError}</p></div>
      )}

      {poll && <PollSession poll={poll} onLeave={leave} />}

      <footer className="app-footer">
        Polls powered by <b>Quorum</b> · Real-time consensus platform
      </footer>
    </div>
  );
}
