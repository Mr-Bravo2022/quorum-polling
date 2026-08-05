import { useEffect } from 'react';
import { useMachine } from '@xstate/react';
import type { Poll } from '../App';
import { pollMachine, type PollStatus } from '../state/pollMachine';
import { subscribeToPoll } from '../mqtt/client';
import AdminPollView from './AdminPollView';
import PublicPollView from './PublicPollView';
import ResultsView from './ResultsView';

export type PollRole = 'admin' | 'public';

interface Props {
  poll: Poll;
  role: PollRole;
  onExit: () => void;
}

/**
 * Drives one poll's UI from the frontend state chart, and picks the right view
 * for who's looking:
 *   - admin  (the owner, arrived via create or the Profile page) — watch + manage
 *   - public (an audience member, arrived via the share URL)     — vote
 * A closed poll shows the final results either way.
 *
 * Lifecycle changes are pushed by the backend over the `status` topic
 * (Publish-Subscribe Channel), so every connected client switches together.
 */
export default function PollSession({ poll, role, onExit }: Props) {
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

  if (status === 'closed') {
    return (
      <ResultsView
        poll={poll}
        onLeave={onExit}
        exitLabel={role === 'admin' ? 'Back to Profile' : 'Back to home'}
      />
    );
  }

  if (role === 'admin') {
    return <AdminPollView poll={poll} status={status} onBack={onExit} />;
  }
  return <PublicPollView poll={poll} status={status} onExit={onExit} />;
}
