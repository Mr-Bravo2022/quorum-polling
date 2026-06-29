import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('polling.db');
let db: Database;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      options TEXT NOT NULL,   -- JSON array of option strings
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL
    )
  `);

  // Audit trail: every vote is a new row; nothing is ever updated or deleted.
  // This is the Perfect Framework Audit Trails requirement.
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      voted_at TEXT NOT NULL
    )
  `);

  // Status change history — point-in-time reconstructability for poll lifecycle.
  db.run(`
    CREATE TABLE IF NOT EXISTS poll_status_log (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      status TEXT NOT NULL,
      changed_at TEXT NOT NULL
    )
  `);

  persist();
  console.log('DB initialised');
}

export function getDb(): Database {
  return db;
}

export function persist(): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}
