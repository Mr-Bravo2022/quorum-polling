import mqtt, { MqttClient } from 'mqtt';

// The class broker speaks MQTT over TLS-WebSocket on 443 (path /mqtt) with auth.
const BROKER_URL = import.meta.env.VITE_MQTT_URL || 'wss://mqtt.uvucs.org:443/mqtt';
const USERNAME   = import.meta.env.VITE_MQTT_USER;
const PASSWORD   = import.meta.env.VITE_MQTT_PASS;
const PREFIX     = import.meta.env.VITE_MQTT_TOPIC_PREFIX || 'cs3660/polling';

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient {
  if (!client) {
    // Publish-Subscribe Channel — browser connects over TLS-WebSocket to the broker.
    client = mqtt.connect(BROKER_URL, {
      clientId: `polling-web-${Math.random().toString(36).slice(2)}`,
      username: USERNAME,
      password: PASSWORD,
      clean: true,
    });
    client.on('connect', () => console.log('[MQTT] connected to', BROKER_URL));
    client.on('error',   (err) => console.error('[MQTT] error:', err.message));
  }
  return client;
}

export function subscribeToPoll(
  pollId: string,
  event: 'results' | 'status',
  handler: (payload: unknown) => void
): () => void {
  const c     = getMqttClient();
  const topic = `${PREFIX}/${pollId}/${event}`;

  c.subscribe(topic, { qos: 1 });
  const listener = (t: string, msg: Buffer) => {
    if (t === topic) handler(JSON.parse(msg.toString()));
  };
  c.on('message', listener);

  // Return an unsubscribe function for cleanup.
  return () => {
    c.unsubscribe(topic);
    c.off('message', listener);
  };
}
