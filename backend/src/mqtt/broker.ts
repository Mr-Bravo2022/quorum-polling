import mqtt, { MqttClient } from 'mqtt';

const PREFIX = process.env.MQTT_TOPIC_PREFIX || 'cs3660/polling';
// The class broker speaks MQTT over TLS-WebSocket on 443 (path /mqtt) and
// requires credentials — see the realtime-web cheatsheet. Override with MQTT_URL.
const URL      = process.env.MQTT_URL  || 'wss://mqtt.uvucs.org:443/mqtt';
const USERNAME = process.env.MQTT_USER;
const PASSWORD = process.env.MQTT_PASS;

let client: MqttClient;

export async function connectMqtt(): Promise<void> {
  return new Promise((resolve) => {
    console.log(`MQTT connecting to ${URL}`);
    // mqtt.js reconnects on its own; reconnectPeriod sets the retry cadence.
    client = mqtt.connect(URL, {
      clientId: `polling-backend-${Math.random().toString(36).slice(2)}`,
      username: USERNAME,
      password: PASSWORD,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });

    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };

    client.on('connect',   () => { console.log(`MQTT connected to ${URL}`); done(); });
    client.on('reconnect', () => console.log('MQTT reconnecting…'));
    client.on('offline',   () => console.warn('MQTT offline — buffering publishes, will retry'));
    client.on('error',     (err) => console.error('MQTT error:', err.message));

    // Don't let an unreachable broker block HTTP startup. The client keeps
    // retrying in the background and flushes queued publishes on reconnect.
    setTimeout(done, 5000);

    client.on('message', (topic, message) => {
      // Incoming message handler — wired up per-route as needed
      console.log(`MQTT message on ${topic}:`, message.toString());
    });
  });
}

// Publish-Subscribe Channel — broadcast an event to all subscribers of a poll topic.
//
// QoS 1 gives Guaranteed Delivery to currently-connected subscribers. `retain`
// additionally asks the broker to hold the last message on the topic and deliver
// it the instant a new client subscribes — last-known-value semantics, so a
// voter who joins mid-poll sees the current tally immediately instead of a blank
// panel. Used for the `results` topic; lifecycle `status` is left non-retained.
export function publish(
  pollId: string,
  event: string,
  payload: unknown,
  opts: { retain?: boolean } = {}
): void {
  const topic = `${PREFIX}/${pollId}/${event}`;
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain: opts.retain ?? false });
}

export function subscribe(pollId: string, event: string, handler: (payload: unknown) => void): void {
  const topic = `${PREFIX}/${pollId}/${event}`;
  client.subscribe(topic, { qos: 1 });
  client.on('message', (t, msg) => {
    if (t === topic) handler(JSON.parse(msg.toString()));
  });
}

export function topicFor(pollId: string, event: string): string {
  return `${PREFIX}/${pollId}/${event}`;
}
