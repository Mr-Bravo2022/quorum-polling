# Quorum Present — Live Polling (CS 3660 Sprint 3 Capstone)

A presenter-and-audience live polling tool in the shape of Slido / Mentimeter.
A presenter opens a poll on a shared screen; the screen shows a **QR code**; each
audience member joins from their phone — by scanning the code with the in-app
camera or their native camera — and votes; the result bars update live for
everyone in the room over MQTT.

**Live:** https://quorum-polling.onrender.com
*(Render free tier — sleeps after ~15 min idle, ~50 s cold start; hit the URL a
minute before demoing.)*

Built on the Sprint 2 core (MQTT pub/sub, the running-tally Aggregator, the
Content-Based Router, the XState poll lifecycle, and the append-only audit
trail), which is reused wholesale.

## What's new in Sprint 3

| Area | What | Where |
|---|---|---|
| **Perfect Framework concern** — Accessibility (WCAG 2.1 AA) | ARIA live-region tally, labeled controls, keyboard focus rings, axe-core gate in CI | `frontend/src/components/*`, `frontend/test/*a11y*` |
| **Advanced platform technology** — Camera API | In-app QR scan-to-join: `getUserMedia` + `BarcodeDetector`, with a jsQR fallback, behind an Adapter | `frontend/src/qr/*`, `frontend/src/components/ScanToJoin.tsx` |
| **3rd GoF pattern** — Adapter | `QrJoinSource` hides the camera/decoder APIs from the UI | `frontend/src/qr/QrJoinSource.ts` |
| **CI/CD pipeline** | Tests + a11y gate on PR; mirror → Render deploy on merge | `.github/workflows/ci.yaml` |
| **Observability** | Structured JSON logs keyed by poll id | `backend/src/observability/logger.ts` |
| Accounts & views (simulated) | Landing page, profile dashboard, and distinct Admin vs Public poll views | `frontend/src/auth/*`, `frontend/src/polls/*`, `frontend/src/components/*` |

## Stack

- **Backend** — Koa + TypeScript + sql.js (SQLite)
- **Frontend** — React 19 + Vite + TypeScript
- **Messaging** — MQTT over WebSocket (class broker `mqtt.uvucs.org`; public
  EMQX broker for local dev)
- **State chart** — XState v5

---

## Perfect Framework concern — Accessibility (WCAG 2.1 AA)

Sprint 2's concern was **Audit Trails** (still present, below); Sprint 3's new
concern is **Accessibility**. A live polling tool used by a whole room is exactly
where accessibility matters, so the concern is native to the product.

| Guideline | Implementation | Where |
|---|---|---|
| **Screen-reader live results** | The results panel is an ARIA live region (`role="status"`, `aria-live="polite"`) so new tallies are *announced* as votes arrive | `frontend/src/components/ResultsView.tsx`, `AdminPollView.tsx` |
| **Never color alone** | Result bars also carry a percentage label and a text "(leading)" marker; bars are `aria-hidden` | `ResultsView.tsx` |
| **Labeled controls** | Form fields use `htmlFor`/`id`; the create form uses `role="group"` + `role="alert"` validation; the public ballot is a `role="radiogroup"` with `aria-checked` options | `CreatePoll.tsx`, `PublicPollView.tsx` |
| **Keyboard operability** | Every control is reachable in a sane tab order with a visible `:focus-visible` ring; `.sr-only` helpers add screen-reader-only context | `frontend/src/index.css` |

**Verification, not assertion.** An automated **axe-core** check runs on every
screen in the frontend test suite (jsdom + jest-axe) and gates every PR in CI.
Alongside it: a manual keyboard + screen-reader pass and a Lighthouse
accessibility run (target ≥ 98).

---

## Advanced platform technology — Camera API

The audience joins by scanning the poll's QR with the **in-app camera** (not just
their native camera app).

- **API surface:** `navigator.mediaDevices.getUserMedia({ video: { facingMode:
  'environment' } })` opens the rear camera into a `<video>`; frames are decoded
  with **`BarcodeDetector`** (`new BarcodeDetector({ formats: ['qr_code'] })`,
  `detect(video)`). `track.stop()` releases the camera the instant a code is read.
- **Permissions-first:** the camera opens only on a user gesture (the "Start
  camera" tap), never on page load; `navigator.permissions.query({ name:
  'camera' })` is checked first.
- **Degradation ladder (behind the same Adapter):** native `BarcodeDetector`
  where present (Chrome/Edge/Android) → **jsQR** decoder for browsers without it
  (notably **iOS Safari**, where `getUserMedia` works but `BarcodeDetector` does
  not) → a manual join-code entry box if the camera is denied.
- On decode, the poll id is pulled from the scanned URL's `#<pollId>` and the
  visitor joins the poll as an audience member.

> **Browser note:** `BarcodeDetector` is Chromium/Android-Chrome only. iPhones
> (all iOS browsers are Safari underneath) use the jsQR fallback — the camera
> still opens and scans in-app. Use Chrome or an iPhone for the live camera demo.

Files: `frontend/src/qr/QrJoinSource.ts` (the Adapter interface + `extractPollId`),
`frontend/src/qr/CameraQrJoinSource.ts` (the concrete camera + decoder),
`frontend/src/components/ScanToJoin.tsx` (the UI).

---

## Vernacular

### Enterprise Integration Patterns (EIPs)

| Pattern | Where | Citation |
|---|---|---|
| **Publish-Subscribe Channel** | MQTT topics per poll (`cs3660/polling/{id}/results`, `/status`) broadcast vote and lifecycle events to all connected clients. `backend/src/mqtt/broker.ts`, `frontend/src/mqtt/client.ts` | enterpriseintegrationpatterns.com/patterns/messaging/PublishSubscribeChannel.html |
| **Aggregator** | `backend/src/patterns/aggregator.ts` — correlates votes by `pollId`, emits a running tally on every new vote | enterpriseintegrationpatterns.com/patterns/messaging/Aggregator.html |
| **Content-Based Router** | `backend/src/patterns/router.ts` — every mutation is dispatched through `route()`, which inspects `message.type` and forwards to the `vote` or `status-change` handler (unknown types hit a Dead Letter Channel log). Wired in `backend/src/routes/polls.ts`. | enterpriseintegrationpatterns.com/patterns/messaging/ContentBasedRouter.html |

A **retained message** is used on the `results` topic: the backend publishes the
tally with the MQTT retain flag set, so a client that joins mid-poll receives the
current counts the instant it subscribes instead of a blank panel. `status`
(lifecycle) events are left non-retained.

### GoF Patterns

| Pattern | Where |
|---|---|
| **State** | Poll lifecycle governed by an XState machine (`backend/src/state/pollMachine.ts`, mirrored on the frontend and driven via `@xstate/react` in `frontend/src/components/PollSession.tsx`) |
| **Strategy** | `backend/src/patterns/tallyStrategy.ts` — the vote-combination algorithm (`SumStrategy`) is injected into the Aggregator behind a `TallyStrategy` interface and is swappable without touching the Aggregator |
| **Adapter** *(new in S3)* | `frontend/src/qr/QrJoinSource.ts` — a 4-verb interface (`isSupported`, `getPermission`, `start`, `stop`) that hides the camera + QR-decoder APIs. The UI never touches `getUserMedia`/`BarcodeDetector`; two decode engines (`BarcodeDetector`, jsQR) sit behind the one interface |

### State chart — poll lifecycle

```
draft ---PUBLISH [guard: optionCount > 1]---> open
open  ---CLOSE------------------------------> closed (terminal)
```

| Term | Value |
|---|---|
| States | `draft`, `open`, `closed` |
| Events | `PUBLISH`, `CLOSE` (+ `SYNC` on the frontend mirror) |
| Guards | `optionCount > 1` — prevents publishing a poll with fewer than 2 options |
| Actions | `updateStatus()` writes to `poll_status_log`; transitions are logged structurally (`poll.status_changed`, keyed by poll id) |

Votes are only accepted in the `open` state (guarded on `POST /polls/:id/vote`).
The frontend machine `SYNC`s to the status the backend broadcasts, so a host
closing the poll moves every connected client to the results view together.

---

## Observability — structured logs

Backend logs are single-line JSON (JSONL), so they're greppable and
machine-queryable. Domain events carry the poll id as a **correlation
identifier**, so one poll's whole story is a single filter:

```bash
node dist/index.js | grep '"pollId":"<id>"'
```

```json
{"ts":"…","level":"info","event":"poll.created","pollId":"c98f…","question":"Log demo?","options":2}
{"ts":"…","level":"info","event":"poll.status_changed","pollId":"c98f…","from":"draft","to":"open"}
{"ts":"…","level":"info","event":"vote.cast","pollId":"c98f…","optionIndex":0,"total":1}
{"ts":"…","level":"info","event":"poll.status_changed","pollId":"c98f…","from":"open","to":"closed"}
{"ts":"…","level":"warn","event":"vote.rejected","pollId":"c98f…","reason":"poll-not-open"}
```

Logger: `backend/src/observability/logger.ts`; events wired in
`backend/src/routes/polls.ts`.

### Metrics — `GET /api/metrics`

A small **RED-method** view (Rate / Errors / Duration) plus gauges, served as
JSON (`backend/src/observability/metrics.ts`):

- **Rate** — votes in the last minute (and per second), polls created.
- **Errors** — rejected votes (to a non-open poll), dead-letter messages.
- **Duration** — average vote-processing time in ms.
- **Gauges** — active (open) polls, votes cast, polls closed/deleted, and
  **join successes vs. camera-denied fallbacks** (reported by the browser via
  `POST /api/metrics/event`, so the camera-join story is visible too).

```jsonc
{
  "rate":     { "votes_per_min": 12, "votes_per_sec": 0.2, "polls_created_total": 3 },
  "errors":   { "votes_rejected_total": 1, "dead_letter_total": 0 },
  "duration": { "vote_avg_ms": 2.4, "vote_samples": 12 },
  "gauges":   { "polls_active": 1, "join_success_total": 8, "camera_fallback_total": 1, ... }
}
```

---

## CI/CD pipeline

GitHub Actions (`.github/workflows/ci.yaml`):

- **On pull request — "Test + accessibility gate":** backend typecheck + Vitest
  (Strategy / Aggregator / Content-Based Router / State machine / logger) **and**
  frontend typecheck + build + the **axe-core** accessibility gate.
- **On merge to `main` — "Mirror to public repo (Render deploy)":** the app is
  force-pushed to the public deploy repo, which Render auto-deploys.

**Two-repo deploy.** The graded source lives in the private repo
`uvucs3660/solisjuan` (which can't deploy on its plan). A mirror job copies the
`polling-app/` tree to the public repo `Mr-Bravo2022/quorum-polling`, and Render
builds from there.

**CI/CD pipeline visible (GitHub Actions URL)** https://github.com/uvucs3660/solisjuan/actions

> **Branch protection** (required status checks that hard-block a red merge) needs
> a paid GitHub plan for a private repo, so the gate runs on every PR but can't
> *enforce* green — the rule is simply "don't merge on red."

---

## Prior concern (Sprint 2) — Audit Trails

Still present. All mutations are append-only:

- `votes` — one row per vote, never updated or deleted.
- `poll_status_log` — one row per status transition.

On startup the backend **rehydrates** from these tables (`rehydrate()` in
`backend/src/routes/polls.ts`): it replays vote counts into the Aggregator and
restores each poll's state-chart actor to its persisted status, so in-memory
state is fully reconstructable after a restart.

## Accounts & views (simulated — no database)

To demo one presenter managing several polls without standing up a database, the
"account" and "my polls" list are simulated in the browser's `localStorage`
(`frontend/src/auth/session.ts`, `frontend/src/polls/store.ts`) — the two seams
you'd swap for real auth + a DB in production. On top of that:

- **Landing page** — public entry point, sign-in, and "Scan to join a poll".
- **Profile dashboard** — create polls; see each poll's live status and vote count.
- **Admin vs Public views** — the owner gets a watch-and-manage view (close,
  share, live tally, no voting); an audience member reached via the share URL gets
  a vote-only view (select → Submit Vote → "Thank you for voting").

---

## Getting started

> **Notes:**
> - Local dev uses the **public EMQX broker** via the checked-in `.env.example`
>   (`wss://broker.emqx.io:8084/mqtt`), so you can run it from anywhere. The
>   **class broker** (`wss://mqtt.uvucs.org:443/mqtt`) requires a username/password
>   (`MQTT_USER`/`MQTT_PASS` on the backend, `VITE_MQTT_USER`/`VITE_MQTT_PASS` on
>   the frontend) and is used for the on-campus demo.
> - The frontend pins React 19 while `@xstate/react` still declares an 18-max peer
>   range, so install the frontend with `--legacy-peer-deps` (runtime-compatible).

```bash
# Backend  (http://localhost:3001)
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend  (http://localhost:5173, separate terminal)
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

### Realtime demo

1. Sign in and create a poll → you land in the **Admin** view (shows the QR).
2. On a phone, open the site → **"Scan to join a poll"** → scan the QR (or use
   your native camera on the projected code) → you get the **Public** vote view.
3. Vote; the Admin tally and the profile vote count update live via the
   Publish-Subscribe Channel.
4. Close the poll from the Admin view; the `status` broadcast moves every client
   to results at once.
