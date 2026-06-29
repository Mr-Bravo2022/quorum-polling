import Router from '@koa/router';
import { v4 as uuid } from 'uuid';
import { createActor } from 'xstate';
import { getDb, persist } from '../db/database';
import { publish } from '../mqtt/broker';
import { aggregate, initTally, restoreTally, getTally, VoteMessage } from '../patterns/aggregator';
import { registerRoute, route } from '../patterns/router';
import { pollMachine, PollEvent } from '../state/pollMachine';

const router = new Router({ prefix: '/api' });

// In-memory poll actor store — one XState actor per active poll.
const pollActors = new Map<string, ReturnType<typeof createActor>>();

// ── Content-Based Router wiring ───────────────────────────────────────────────
// Every mutation is dispatched through the Content-Based Router, which inspects
// message.type and forwards to the matching handler. Endpoints below never call
// aggregate/publish directly — they hand a typed message to route().
registerRoute('vote', (payload) => {
  const vote = payload as VoteMessage;
  const tally = aggregate(vote);
  // Retain the running tally so a client joining mid-poll gets it immediately.
  publish(vote.pollId, 'results', tally, { retain: true });
});

registerRoute('status-change', (payload) => {
  const { pollId, status } = payload as { pollId: string; status: string };
  updateStatus(pollId, status);
  publish(pollId, 'status', { status });
});

// POST /api/polls — create a new poll in draft state.
router.post('/polls', async (ctx) => {
  const { question, options } = ctx.request.body as { question: string; options: string[] };
  const id = uuid();
  const now = new Date().toISOString();

  const db = getDb();
  db.run(
    'INSERT INTO polls (id, question, options, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, question, JSON.stringify(options), 'draft', now]
  );
  db.run(
    'INSERT INTO poll_status_log (id, poll_id, status, changed_at) VALUES (?, ?, ?, ?)',
    [uuid(), id, 'draft', now]
  );
  persist();

  initTally(id, options.length);

  const actor = createActor(pollMachine, { input: { pollId: id, optionCount: options.length } });
  actor.start();
  pollActors.set(id, actor);

  // Seed a retained zero tally so the first subscriber sees the poll, not a blank.
  publish(id, 'results', getTally(id), { retain: true });

  ctx.body = { id, question, options, status: 'draft' };
});

// GET /api/polls/:id — get poll details (used by clients joining an existing poll).
router.get('/polls/:id', async (ctx) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM polls WHERE id = ?', [ctx.params.id]);
  if (!result.length || !result[0].values.length) {
    ctx.status = 404;
    return;
  }
  const [id, question, options, status, created_at] = result[0].values[0];
  ctx.body = { id, question, options: JSON.parse(options as string), status, created_at };
});

// POST /api/polls/:id/publish — transition draft -> open.
router.post('/polls/:id/publish', async (ctx) => {
  await transition(ctx, 'PUBLISH');
});

// POST /api/polls/:id/vote — cast a vote.
router.post('/polls/:id/vote', async (ctx) => {
  const { optionIndex } = ctx.request.body as { optionIndex: number };
  const pollId = ctx.params.id;
  const now = new Date().toISOString();

  // Guard: only accept votes when the state chart is in `open`.
  const actor = pollActors.get(pollId);
  if (!actor || actor.getSnapshot().value !== 'open') {
    ctx.status = 409;
    ctx.body = { error: 'Poll is not open for voting' };
    return;
  }

  const db = getDb();
  db.run(
    'INSERT INTO votes (id, poll_id, option_index, voted_at) VALUES (?, ?, ?, ?)',
    [uuid(), pollId, optionIndex, now]
  );
  persist();

  // Dispatch through the Content-Based Router; it aggregates and broadcasts.
  await route({ type: 'vote', payload: { pollId, optionIndex, votedAt: now } as VoteMessage });

  ctx.body = getTally(pollId);
});

// POST /api/polls/:id/close — transition open -> closed (final).
router.post('/polls/:id/close', async (ctx) => {
  await transition(ctx, 'CLOSE');
});

// GET /api/polls/:id/results — point-in-time tally rebuilt from the audit trail.
router.get('/polls/:id/results', async (ctx) => {
  const db = getDb();
  const result = db.exec(
    'SELECT option_index, COUNT(*) as count FROM votes WHERE poll_id = ? GROUP BY option_index',
    [ctx.params.id]
  );
  ctx.body = result.length ? result[0].values : [];
});

// Drive the state chart by one event, then dispatch the resulting status change
// through the Content-Based Router. Returns false (and sets ctx) if the event
// was rejected (no actor, or a guard blocked the transition).
async function transition(ctx: any, event: PollEvent['type']): Promise<boolean> {
  const pollId = ctx.params.id;
  const actor = pollActors.get(pollId);
  if (!actor) { ctx.status = 404; return false; }

  const before = actor.getSnapshot().value;
  actor.send({ type: event } as PollEvent);
  const status = actor.getSnapshot().value as string;

  if (status === before) {
    // Guard blocked it or the event isn't valid in this state.
    ctx.status = 409;
    ctx.body = { error: `Cannot ${event} from ${before}` };
    return false;
  }

  await route({ type: 'status-change', payload: { pollId, status } });
  ctx.body = { status };
  return true;
}

function updateStatus(pollId: string, status: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.run('UPDATE polls SET status = ? WHERE id = ?', [status, pollId]);
  db.run(
    'INSERT INTO poll_status_log (id, poll_id, status, changed_at) VALUES (?, ?, ?, ?)',
    [uuid(), pollId, status, now]
  );
  persist();
}

// Map a persisted status to the event sequence that reaches it from `draft`.
function statusToEvents(status: string): PollEvent['type'][] {
  switch (status) {
    case 'open':   return ['PUBLISH'];
    case 'closed': return ['PUBLISH', 'CLOSE'];
    default:       return [];
  }
}

// Rebuild in-memory tallies and state-chart actors from the append-only tables
// so the system is fully reconstructable after a restart (audit-trail concern).
export function rehydrate(): void {
  const db = getDb();
  const res = db.exec('SELECT id, options, status FROM polls');
  if (!res.length) return;

  for (const row of res[0].values) {
    const [id, optionsJson, status] = row as [string, string, string];
    const options = JSON.parse(optionsJson) as string[];

    // Replay vote counts from the audit trail.
    initTally(id, options.length);
    const counts = new Array(options.length).fill(0);
    const vres = db.exec(
      'SELECT option_index, COUNT(*) FROM votes WHERE poll_id = ? GROUP BY option_index',
      [id]
    );
    if (vres.length) {
      for (const [idx, count] of vres[0].values as [number, number][]) {
        counts[idx] = count;
      }
    }
    restoreTally(id, counts);

    // Restore the state-chart actor to its persisted status.
    const actor = createActor(pollMachine, { input: { pollId: id, optionCount: options.length } });
    actor.start();
    for (const type of statusToEvents(status)) actor.send({ type } as PollEvent);
    pollActors.set(id, actor);
  }

  console.log(`Rehydrated ${res[0].values.length} poll(s) from audit trail`);
}

export default router;
