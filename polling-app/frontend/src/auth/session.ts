/**
 * Simulated sign-in — NO real authentication, NO server, NO database.
 *
 * The whole "account" is a name we remember in the browser's own storage
 * (localStorage). It survives refreshes and closing the tab, which is enough to
 * demo that one person can sign in and manage several polls. In a production
 * build this module is the single seam you'd swap for a real auth provider +
 * database; nothing else in the UI talks to storage directly.
 */

export interface User {
  name: string;
}

const KEY = 'quorum.user';

/** The currently "signed-in" user, or null if nobody has signed in yet. */
export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    // Storage disabled/corrupt — behave as signed-out rather than crash.
    return null;
  }
}

/** Remember a user as signed in. */
export function signIn(user: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable — the caller still proceeds for this session */
  }
}

/** Forget the signed-in user. */
export function signOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}
