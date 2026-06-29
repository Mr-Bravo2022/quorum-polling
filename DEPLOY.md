# Deploying Quorum (public, shareable URL)

The app deploys as **one service**: the Koa backend serves both the REST API and
the built React frontend, so there's a single origin and a single share link.
The realtime layer uses the **public broker** `broker.emqx.io` (works from any
network — unlike the campus broker, which is firewalled to UVU IPs).

After deploy, the share links look like `https://<your-app>.onrender.com/#<pollId>`
and anyone on the internet can open them and vote.

---

## Option A — Render Blueprint (recommended, no Docker)

Render reads [`render.yaml`](render.yaml) and provisions everything.

1. Push this repo to GitHub (`git push`).
2. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
3. Connect the GitHub repo. (If it's in the `uvucs3660` org and Render can't see
   it, an org owner has to approve Render's GitHub app — or fork the repo to your
   personal GitHub and deploy that.)
4. Render detects `polling-app/render.yaml`, shows the `quorum-polling` service →
   **Apply**.
5. Wait for the build (~2–4 min). You get a URL like
   `https://quorum-polling.onrender.com`. Open it.

**Free-tier note:** the service sleeps after ~15 min idle; the first request then
takes ~50s to wake. Hit the URL a minute before demoing.

## Option B — Render manual (no blueprint)

New → **Web Service** → connect repo, then:
- **Root Directory:** `polling-app`
- **Build Command:** `cd frontend && npm install --legacy-peer-deps && npm run build && cd ../backend && npm install && npm run build`
- **Start Command:** `cd backend && node dist/index.js`
- **Environment variables:** copy the five from `render.yaml`
  (`NODE_ENV`, `MQTT_URL`, `MQTT_TOPIC_PREFIX`, `VITE_MQTT_URL`, `VITE_MQTT_TOPIC_PREFIX`).

## Option C — Any container host (Fly.io / Railway / Cloud Run)

A [`Dockerfile`](Dockerfile) is included (multi-stage: builds frontend + backend,
runtime serves both). Example with Fly:

```bash
cd polling-app
fly launch --dockerfile Dockerfile   # accept defaults; internal port 3001
fly deploy
```

The broker URL + topic prefix have sane defaults baked in; override with
`--build-arg VITE_MQTT_URL=…` / env vars if needed.

---

## Switching brokers

`MQTT_TOPIC_PREFIX` / `VITE_MQTT_TOPIC_PREFIX` must **match** between backend and
frontend, and should be unique to you on the shared public broker
(`quorum/solisjuan/polling`). For the on-campus class broker, set both `MQTT_URL`
and `VITE_MQTT_URL` to `wss://mqtt.uvucs.org:443/mqtt` — but note a public host
can't reach that broker (campus-only), so use the public broker for the public
deploy.
