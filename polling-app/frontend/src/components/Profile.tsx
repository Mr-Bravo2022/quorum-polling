import { useEffect, useRef, useState, useCallback } from 'react';
import type { Poll } from '../App';
import type { User } from '../auth/session';
import { listPolls, addPoll, removePoll, type StoredPoll } from '../polls/store';
import { subscribeToPoll } from '../mqtt/client';
import CreatePoll from './CreatePoll';

interface Props {
  user: User;
  /** Load one of my existing polls (into its manage view). */
  onOpenPoll: (id: string) => void;
  /** Navigate to a poll right after creating it. */
  onCreated: (poll: Poll) => void;
}

/** Live status pulled from the backend for each of my polls. */
type Status = 'open' | 'closed' | 'draft' | 'unavailable' | 'loading';

/**
 * The signed-in home. Where a user lands after signing in: a dashboard listing
 * the polls they've created (with live status from the backend) plus a way to
 * create a new one. Poll ownership is simulated in the browser — see
 * polls/store.ts.
 */
export default function Profile({ user, onOpenPoll, onCreated }: Props) {
  const [mode, setMode]       = useState<'list' | 'create'>('list');
  const [polls, setPolls]     = useState<StoredPoll[]>(() => listPolls());
  const [status, setStatus]   = useState<Record<string, Status>>({});
  const [votes, setVotes]     = useState<Record<string, number>>({});
  const [pendingDelete, setPendingDelete] = useState<StoredPoll | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);

  // Ask the backend for the current status and vote count of each of my polls.
  // The store only remembers *which* polls are mine; open/closed and the tally
  // are the backend's truth.
  const refreshStatuses = useCallback((mine: StoredPoll[]) => {
    mine.forEach((p) => {
      setStatus((s) => ({ ...s, [p.id]: s[p.id] ?? 'loading' }));
      fetch(`/api/polls/${p.id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((full: Poll) => setStatus((s) => ({ ...s, [p.id]: full.status as Status })))
        .catch(() => setStatus((s) => ({ ...s, [p.id]: 'unavailable' })));

      // Total votes = sum of the per-option counts from the results endpoint.
      fetch(`/api/polls/${p.id}/results`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rows: [number, number][]) =>
          setVotes((v) => ({ ...v, [p.id]: rows.reduce((sum, [, count]) => sum + count, 0) })))
        .catch(() => { /* leave the count unknown if the poll has aged out */ });
    });
  }, []);

  useEffect(() => {
    refreshStatuses(polls);
    // Only on mount / when the set of polls changes.
  }, [polls, refreshStatuses]);

  // Keep the overview live: subscribe each poll to its results + status topics
  // (Publish-Subscribe Channel) so vote counts and open/closed change in place
  // as the audience votes — no refresh needed. The retained results message
  // means we also get the current tally the moment we subscribe.
  useEffect(() => {
    const unsubs = polls.flatMap((p) => [
      subscribeToPoll(p.id, 'results', (payload) => {
        const { total } = payload as { total: number };
        setVotes((v) => ({ ...v, [p.id]: total }));
      }),
      subscribeToPoll(p.id, 'status', (payload) => {
        const { status: next } = payload as { status: Status };
        setStatus((s) => ({ ...s, [p.id]: next }));
      }),
    ]);
    return () => unsubs.forEach((off) => off());
  }, [polls]);

  function handleCreated(poll: Poll) {
    addPoll({ id: poll.id, question: poll.question });
    setPolls(listPolls());
    onCreated(poll);
  }

  // Close an open poll straight from the overview. Optimistically flip the pill;
  // the backend broadcast (status topic) confirms it for every other client too.
  async function closePoll(id: string) {
    setBusyId(id);
    setStatus((s) => ({ ...s, [id]: 'closed' }));
    try {
      await fetch(`/api/polls/${id}/close`, { method: 'POST' });
    } catch {
      /* the live status subscription will correct the pill if this failed */
    }
    setBusyId(null);
  }

  // Close (if still open) then permanently delete, and drop it from my list.
  // Works for "unavailable" rows too — the DELETE is idempotent, so a poll that
  // already aged out of the backend is simply removed from the browser list.
  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setBusyId(target.id);
    try { await fetch(`/api/polls/${target.id}/close`, { method: 'POST' }); } catch { /* ignore */ }
    try { await fetch(`/api/polls/${target.id}`, { method: 'DELETE' }); } catch { /* ignore */ }
    removePoll(target.id);
    setPolls(listPolls());
    setBusyId(null);
    setPendingDelete(null);
  }

  if (mode === 'create') {
    return (
      <div>
        <button
          type="button"
          className="btn btn-ghost back-btn"
          onClick={() => setMode('list')}
        >
          ← Back to my polls
        </button>
        <CreatePoll onCreated={handleCreated} />
      </div>
    );
  }

  return (
    <section className="card" aria-label={`${user.name}'s polls`}>
      <div className="profile-head">
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Welcome, {user.name}
          </h2>
          <p className="profile-sub">Create a new poll or manage the ones you’ve run.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setMode('create')}>
          + Create a poll
        </button>
      </div>

      <h3 className="section-label">Your polls</h3>

      {polls.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No polls yet</p>
          <p className="empty-body">
            Create your first poll and it’ll show up here so you can reopen or
            manage it anytime.
          </p>
        </div>
      ) : (
        <ul className="poll-list">
          {polls.map((p) => {
            const st = status[p.id] ?? 'loading';
            return (
              <li className="poll-row" key={p.id}>
                <div className="poll-row-main">
                  <span className="poll-row-q">{p.question}</span>
                  <StatusPill status={st} />
                  <span className="poll-votes">
                    {votes[p.id] ?? 0} vote{(votes[p.id] ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="poll-row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenPoll(p.id)}
                    disabled={st === 'unavailable'}
                    aria-label={`Open poll: ${p.question}`}
                  >
                    {st === 'unavailable' ? 'Unavailable' : 'Open'}
                  </button>
                  {st === 'open' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => closePoll(p.id)}
                      disabled={busyId === p.id}
                      aria-label={`Close poll: ${p.question}`}
                    >
                      Close
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setPendingDelete(p)}
                    aria-label={`Delete poll: ${p.question}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDeleteDialog
          question={pendingDelete.question}
          busy={busyId === pendingDelete.id}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}

/** Accessible "are you sure?" dialog for the destructive delete. */
function ConfirmDeleteDialog({
  question, busy, onConfirm, onCancel,
}: {
  question: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus(); // safe default target
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-title"
        aria-describedby="del-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="del-title" className="card-title" style={{ marginBottom: '0.5rem' }}>
          Delete this poll?
        </h3>
        <p id="del-desc" className="profile-sub" style={{ marginBottom: '1.25rem' }}>
          “{question}” will be closed and permanently deleted. This can’t be undone.
        </p>
        <div className="actions">
          <span className="spacer" />
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Close & delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { cls: string; label: string }> = {
    open:        { cls: 'pill-open',   label: 'Open' },
    closed:      { cls: 'pill-closed', label: 'Closed' },
    draft:       { cls: 'pill-draft',  label: 'Draft' },
    loading:     { cls: 'pill-closed', label: '…' },
    unavailable: { cls: 'pill-closed', label: 'Unavailable' },
  };
  const { cls, label } = map[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}
