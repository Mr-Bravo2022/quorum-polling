/**
 * Content-Based Router (EIP)
 *
 * Examines an incoming message and routes it to the correct handler
 * based on the message's content (its type field).
 *
 * Incoming message types:
 *   'vote'         -> vote handler (increment tally, write audit row)
 *   'status-change'-> poll lifecycle handler (open, close, etc.)
 *   unknown        -> dead-letter log
 */

export type MessageType = 'vote' | 'status-change';

export interface IncomingMessage {
  type: MessageType;
  payload: unknown;
}

type Handler = (payload: unknown) => void | Promise<void>;

const routes = new Map<MessageType, Handler>();

export function registerRoute(type: MessageType, handler: Handler): void {
  routes.set(type, handler);
}

export async function route(message: IncomingMessage): Promise<void> {
  const handler = routes.get(message.type);
  if (handler) {
    await handler(message.payload);
  } else {
    // Dead Letter Channel — unroutable messages logged for inspection.
    console.warn('[Content-Based Router] unroutable message type:', message.type, message.payload);
  }
}
