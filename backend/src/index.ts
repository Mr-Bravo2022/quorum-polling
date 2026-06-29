import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import Koa from 'koa';
import serve from 'koa-static';
import { bodyParser } from '@koa/bodyparser';
import cors from '@koa/cors';
import pollRouter, { rehydrate } from './routes/polls';
import { connectMqtt } from './mqtt/broker';
import { initDb } from './db/database';

const app = new Koa();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(bodyParser());
app.use(pollRouter.routes());
app.use(pollRouter.allowedMethods());

// In production (the single-container deploy) the backend also serves the built
// React app, so the whole thing lives on one origin/URL — no CORS, one share link.
// In dev this is skipped; Vite serves the frontend and proxies /api here.
const SERVE_STATIC = process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true';
const STATIC_DIR = path.resolve(__dirname, '../../frontend/dist');

if (SERVE_STATIC && fs.existsSync(STATIC_DIR)) {
  app.use(serve(STATIC_DIR));
  // SPA fallback: any non-API, non-file GET returns index.html so client-side
  // routing (and the #pollId share links) work on a hard refresh.
  app.use(async (ctx, next) => {
    if (ctx.method === 'GET' && !ctx.path.startsWith('/api') && !ctx.path.includes('.')) {
      ctx.type = 'html';
      ctx.body = fs.createReadStream(path.join(STATIC_DIR, 'index.html'));
    } else {
      await next();
    }
  });
  console.log(`Serving frontend from ${STATIC_DIR}`);
}

async function start() {
  await initDb();
  await connectMqtt();
  rehydrate();   // restore tallies + state-chart actors from the audit trail
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

start().catch(console.error);
