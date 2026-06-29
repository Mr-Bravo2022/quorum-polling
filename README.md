# Live Polling App — Sprint 2

A real-time multi-component polling system. Users create polls, others vote, and results update live for every connected client.

## Stack

- **Backend** — Koa + TypeScript + sql.js (SQLite)
- **Frontend** — React + Vite + TypeScript
- **Messaging** — MQTT (`mqtt.uvucs.org`) over WebSocket
- **State chart** — XState v5

## Enterprise Integration Patterns

| Pattern | Where | Citation |
|---|---|---|
| **Publish-Subscribe Channel** | MQTT topics per poll (`cs3660/polling/{id}/results`, `/status`) broadcast vote and lifecycle events to all connected clients. `backend/src/mqtt/broker.ts`, `frontend/src/mqtt/client.ts` | enterpriseintegrationpatterns.com/patterns/messaging/PublishSubscribeChannel.html |
| **Aggregator** | `backend/src/patterns/aggregator.ts` — correlates votes by `pollId`, emits a running tally on every new vote | enterpriseintegrationpatterns.com/patterns/messaging/Aggregator.html |
| **Content-Based Router** | `backend/src/patterns/router.ts` — every mutation is dispatched through `route()`, which inspects `message.type` and forwards to the `vote` or `status-change` handler (unknown types hit a Dead Letter Channel log). Wired in `backend/src/routes/polls.ts`. | enterpriseintegrationpatterns.com/patterns/messaging/ContentBasedRouter.html |

A **retained message** is used on the `results` topic: the backend publishes the
tally with the MQTT retain flag set, so a client that joins mid-poll receives the
current counts the instant it subscribes instead of a blank panel. `status`
(lifecycle) events are left non-retained.

## GoF Patterns

| Pattern | Where |
|---|---|
| **State** | Poll lifecycle governed by an XState machine (`backend/src/state/pollMachine.ts`, mirrored on the frontend and driven via `@xstate/react` in `frontend/src/components/PollSession.tsx`) |
| **Strategy** | `backend/src/patterns/tallyStrategy.ts` — the vote-combination algorithm (`SumStrategy`) is injected into the Aggregator behind a `TallyStrategy` interface and is swappable without touching the Aggregator. Same shape as the Sprint 1 LLM-transport Strategy. |

## State Chart — Poll Lifecycle

```
draft ---PUBLISH [guard: optionCount > 1]---> open
open  ---CLOSE------------------------------> closed
closed---SHOW_RESULTS-----------------------> results
results--RESET------------------------------> draft
```

| Term | Value |
|---|---|
| States | `draft`, `open`, `closed`, `results` |
| Events | `PUBLISH`, `CLOSE`, `SHOW_RESULTS`, `RESET` (+ `SYNC` on the frontend mirror) |
| Guards | `optionCount > 1` — prevents publishing a poll with fewer than 2 options |
| Actions | Entry logging on every state; `updateStatus()` writes to `poll_status_log` |

Every transition is reachable from the UI: a poll is opened, closed, published to
results, and reset, each firing the matching event. Votes are only accepted in the
`open` state (the guard on `POST /polls/:id/vote`). The frontend machine `SYNC`s to
the status the backend broadcasts, so a host closing the poll moves every connected
client to the results view together.

## Audit Trails (Perfect Framework)

All mutations are append-only:

- `votes` table — one row per vote, never updated or deleted. The full vote history is reconstructable from scratch.
- `poll_status_log` table — one row per status transition. The poll lifecycle is reconstructable at any point in time.

On startup the backend **rehydrates** from these tables (`rehydrate()` in
`backend/src/routes/polls.ts`): it replays vote counts into the Aggregator and
restores each poll's state-chart actor to its persisted status, so in-memory state
is fully reconstructable after a restart.

## Realtime message-flow demo

1. Create a poll — the browser URL becomes shareable (`…/#<pollId>`).
2. Open that URL in a second browser/client to join the **same** poll.
3. Both clients vote; tallies update live for everyone via the Publish-Subscribe Channel.
4. The host closes the poll; the `status` broadcast moves every client to results at once.

## Getting started

> **Notes:**
> - The class MQTT broker is reached at `wss://mqtt.uvucs.org:443/mqtt` (TLS
>   WebSocket on 443) and requires a **username/password** — set `MQTT_USER` /
>   `MQTT_PASS` (backend) and `VITE_MQTT_USER` / `VITE_MQTT_PASS` (frontend) in
>   your `.env` files. No VPN is needed; port 443 is open everywhere.
> - The frontend pins React 19 while `@xstate/react` still declares an 18-max
>   peer range, so install the frontend with `--legacy-peer-deps`
>   (runtime-compatible).

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```
