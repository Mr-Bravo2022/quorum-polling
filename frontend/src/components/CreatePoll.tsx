import { useState } from 'react';
import type { Poll } from '../App';

interface Props {
  onCreated: (poll: Poll) => void;
}

export default function CreatePoll({ onCreated }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions]   = useState(['', '']);
  const [loading, setLoading]   = useState(false);

  function addOption() {
    setOptions([...options, '']);
  }

  function setOption(i: number, val: string) {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.filter(o => o.trim().length > 0);
    if (filled.length < 2) return;

    setLoading(true);
    const res  = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options: filled }),
    });
    const poll = await res.json();

    // Publish the poll (draft -> open) right after creation.
    await fetch(`/api/polls/${poll.id}/publish`, { method: 'POST' });
    setLoading(false);
    onCreated({ ...poll, status: 'open' });
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">Create a poll</h2>

      <div className="field">
        <label className="label">Question</label>
        <input
          className="input"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="What should we ask?"
          required
        />
      </div>

      <div className="field">
        <label className="label">Options</label>
        <div className="option-inputs">
          {options.map((opt, i) => (
            <input
              key={i}
              className="input"
              value={opt}
              onChange={e => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-ghost btn-block" onClick={addOption}>
        + Add option
      </button>

      <div className="actions">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? 'Creating…' : 'Create & open poll'}
        </button>
      </div>
    </form>
  );
}
