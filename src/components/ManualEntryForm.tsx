// ============================================================
// Manual time entry / backfill form
// ============================================================

import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useApp } from '../context/AppContext';
import { calcDuration } from '../utils/time';

export const ManualEntryForm: React.FC = () => {
  const { state, dispatch } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [taskId, setTaskId] = useState(state.tasks[0]?.id ?? '');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');
  const [note, setNote] = useState('');

  if (!expanded) {
    return (
      <button className="btn btn--secondary btn--full" onClick={() => setExpanded(true)}>
        + Add Manual Entry
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !startStr || !endStr) return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const startTime = new Date(startStr).toISOString();
    const endTime = new Date(endStr).toISOString();

    dispatch({
      type: 'ADD_MANUAL_ENTRY',
      entry: {
        id: uuid(),
        taskId,
        taskName: task.name,
        date: state.currentDate,
        startTime,
        endTime,
        duration: calcDuration(startTime, endTime),
        note,
      },
    });

    setExpanded(false);
    setNote('');
    setStartStr('');
    setEndStr('');
  };

  return (
    <form className="manual-entry" onSubmit={handleSubmit}>
      <h4>Manual Entry</h4>

      <label className="field">
        <span>Task</span>
        <select value={taskId} onChange={e => setTaskId(e.target.value)}>
          {state.tasks.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Start</span>
        <input
          type="datetime-local"
          value={startStr}
          onChange={e => setStartStr(e.target.value)}
          step="60"
          required
        />
      </label>

      <label className="field">
        <span>End</span>
        <input
          type="datetime-local"
          value={endStr}
          onChange={e => setEndStr(e.target.value)}
          step="60"
          required
        />
      </label>

      <label className="field">
        <span>Note</span>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note"
        />
      </label>

      <div className="modal__actions">
        <button type="button" className="btn btn--secondary" onClick={() => setExpanded(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Add Entry
        </button>
      </div>
    </form>
  );
};
