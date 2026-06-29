import { useEffect } from 'react';
import { useMachine } from '@xstate/react';
import type { Poll } from '../App';
import { pollMachine, type PollStatus } from '../state/pollMachine';
import { subscribeToPoll } from '../mqtt/client';
import VotingView from './VotingView';
import ResultsView from './ResultsView';

interface Props {
  poll: Poll;
  onLeave: () => void;
}

/**
 * Drives one poll's UI from the frontend state chart. The machine's current
 * state — not local view flags — decides whether we show voting or results.
 *
 * Lifecycle changes are pushed by the backend over the `status` topic
 * (Publish-Subscribe Channel). When the host closes the poll, every connected
 * client receives the status event, SYNCs its machine, and switches to results
 * together. That shared transition is the realtime message-flow we demo.
 */
export default function PollSession({ poll, onLeave }: Props) {
  const [state, send] = useMachine(pollMachine, {
    input: { pollId: poll.id, optionCount: poll.options.length },
  });

  // Snap to the status the poll already had when we joined.
  useEffect(() => {
    send({ type: 'SYNC', status: poll.status as PollStatus });
  }, [poll.id, poll.status, send]);

  // Follow lifecycle changes broadcast by the backend.
  useEffect(() => {
    const unsub = subscribeToPoll(poll.id, 'status', (payload) => {
      const { status } = payload as { status: PollStatus };
      send({ type: 'SYNC', status });
    });
    return unsub;
  }, [poll.id, send]);

  const status = state.value as PollStatus;

  if (status === 'closed' || status === 'results') {
    return <ResultsView poll={poll} status={status} onLeave={onLeave} />;
  }
  return <VotingView poll={poll} status={status} onLeave={onLeave} />;
}
