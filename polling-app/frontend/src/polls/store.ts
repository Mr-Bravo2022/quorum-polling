/**
 * The signed-in user's "my polls" list — simulated ownership, NO database.
 *
 * When someone creates a poll we remember its id + question here (in the
 * browser's localStorage) so the Profile page can list the polls they've made.
 * The *live status* of each poll (open/closed) still comes from the backend,
 * which is the real source of truth; this store just records which polls are
 * "mine". In production this is the seam you'd replace with a real per-user
 * polls table. See auth/session.ts for the matching account seam.
 */

export interface StoredPoll {
  id: string;
  question: string;
  createdAt: number;
}

const KEY = 'quorum.polls';

/** Every poll this browser has created, newest first. */
export function listPolls(): StoredPoll[] {
  try {
    const raw = localStorage.getItem(KEY);
    const polls = raw ? (JSON.parse(raw) as StoredPoll[]) : [];
    return [...polls].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Record a newly created poll as mine (de-duplicated by id). */
export function addPoll(poll: Omit<StoredPoll, 'createdAt'> & { createdAt?: number }): void {
  try {
    const existing = listPolls().filter((p) => p.id !== poll.id);
    const next: StoredPoll[] = [
      { id: poll.id, question: poll.question, createdAt: poll.createdAt ?? Date.now() },
      ...existing,
    ];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the poll still exists on the backend this session */
  }
}

/** Forget a poll (used if it has aged out of the backend). */
export function removePoll(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listPolls().filter((p) => p.id !== id)));
  } catch {
    /* nothing to do */
  }
}
