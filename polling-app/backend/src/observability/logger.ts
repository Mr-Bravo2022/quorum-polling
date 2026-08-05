/**
 * Structured logging — the Sprint 3 Observability concern.
 *
 * Every log line is a single JSON object (JSONL), so logs are greppable and
 * machine-queryable instead of free-form prose. Domain events carry the poll id
 * as a **correlation identifier** (`pollId`), so you can reconstruct one poll's
 * entire story from the log stream:
 *
 *     node dist/index.js | grep '"pollId":"<id>"'
 *
 * Kept dependency-free on purpose — a logging library isn't needed to emit
 * structured JSON, and this keeps the demo (and the deploy) simple.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  /** Correlation id: the poll a log line belongs to, when applicable. */
  pollId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const record = { ts: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(record);
  // Preserve stdout/stderr semantics so log processors can split by stream.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info:  (event: string, fields: LogFields = {}) => emit('info', event, fields),
  warn:  (event: string, fields: LogFields = {}) => emit('warn', event, fields),
  error: (event: string, fields: LogFields = {}) => emit('error', event, fields),
};
