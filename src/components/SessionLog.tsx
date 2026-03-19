// ============================================================
// Running log of today's sessions — editable times and notes
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime, formatDuration, calcDuration } from '../utils/time';
import type { TimeEntry } from '../types';

export const SessionLog: React.FC = () => {
  const { state, dispatch } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);

  const completedEntries = state.entries
    .filter(e => e.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const tf = state.settings.timeFormat;

  if (completedEntries.length === 0) {
    return (
      <div className="session-log session-log--empty">
        <p>No completed sessions yet today. Click a task to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="session-log">
      <h3>Today's Sessions</h3>
      <div className="session-log__list">
        {completedEntries.map(entry => (
          <SessionRow
            key={entry.id}
            entry={entry}
            timeFormat={tf}
            isEditing={editingId === entry.id}
            onEdit={() => setEditingId(entry.id)}
            onSave={(updated) => {
              dispatch({ type: 'UPDATE_ENTRY', entry: updated });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
            onDelete={() => {
              if (confirm('Delete this session?')) {
                dispatch({ type: 'DELETE_ENTRY', entryId: entry.id });
              }
            }}
            onNoteChange={(note) => {
              dispatch({ type: 'SET_ENTRY_NOTE', entryId: entry.id, note });
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ---- Individual session row ----

interface RowProps {
  entry: TimeEntry;
  timeFormat: '12h' | '24h';
  isEditing: boolean;
  onEdit: () => void;
  onSave: (entry: TimeEntry) => void;
  onCancel: () => void;
  onDelete: () => void;
  onNoteChange: (note: string) => void;
}

const SessionRow: React.FC<RowProps> = ({
  entry, timeFormat, isEditing, onEdit, onSave, onCancel, onDelete, onNoteChange
}) => {
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  const handleEditStart = () => {
    // Convert ISO to local datetime-local format
    const start = new Date(entry.startTime);
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    setStartStr(toLocalDatetimeStr(start));
    setEndStr(toLocalDatetimeStr(end));
    onEdit();
  };

  const handleSave = () => {
    const newStart = new Date(startStr).toISOString();
    const newEnd = new Date(endStr).toISOString();
    onSave({
      ...entry,
      startTime: newStart,
      endTime: newEnd,
      duration: calcDuration(newStart, newEnd),
    });
  };

  if (isEditing) {
    return (
      <div className="session-row session-row--editing">
        <div className="session-row__edit-fields">
          <label>
            Start:
            <input
              type="datetime-local"
              value={startStr}
              onChange={e => setStartStr(e.target.value)}
              step="60"
            />
          </label>
          <label>
            End:
            <input
              type="datetime-local"
              value={endStr}
              onChange={e => setEndStr(e.target.value)}
              step="60"
            />
          </label>
        </div>
        <div className="session-row__edit-actions">
          <button className="btn btn--small btn--primary" onClick={handleSave}>Save</button>
          <button className="btn btn--small btn--secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-row">
      <div className="session-row__time">
        {formatTime(entry.startTime, timeFormat)} – {formatTime(entry.endTime!, timeFormat)}
      </div>
      <div className="session-row__task">{entry.taskName}</div>
      <div className="session-row__duration">
        {formatDuration(entry.duration ?? 0)}
      </div>
      <input
        className="session-row__note"
        type="text"
        placeholder="Add note..."
        value={entry.note}
        onChange={e => onNoteChange(e.target.value)}
      />
      <div className="session-row__actions">
        <button
          className="btn btn--icon"
          onClick={handleEditStart}
          title="Edit times"
        >
          &#9998;
        </button>
        <button
          className="btn btn--icon btn--icon-danger"
          onClick={onDelete}
          title="Delete"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
};

function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
