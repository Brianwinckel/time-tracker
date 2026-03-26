// ============================================================
// Running log of today's sessions — editable times, notes, and tags
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime, formatDuration, calcDuration } from '../utils/time';
import { TagSelector } from './TagSelector';
import type { TimeEntry } from '../types';

// Status → color mapping
const STATUS_COLORS: Record<string, string> = {
  'Completed': '#50B86C',
  'In Progress': '#F5A623',
  'Waiting for Review': '#00BCD4',
  'Waiting for Approval': '#9B59B6',
  'Blocked': '#E85D75',
  'Deferred': '#607D8B',
  'Shelved': '#795548',
  'Scrapped': '#FF7043',
};

export const SessionLog: React.FC = () => {
  const { state, dispatch } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagsOpenId, setTagsOpenId] = useState<string | null>(null);

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
            tagsOpen={tagsOpenId === entry.id}
            onEdit={() => setEditingId(entry.id)}
            onToggleTags={() => setTagsOpenId(tagsOpenId === entry.id ? null : entry.id)}
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
            onTagChange={(field, value) => {
              dispatch({ type: 'SET_ENTRY_TAGS', entryId: entry.id, tags: { [field]: value } });
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
  tagsOpen: boolean;
  onEdit: () => void;
  onToggleTags: () => void;
  onSave: (entry: TimeEntry) => void;
  onCancel: () => void;
  onDelete: () => void;
  onNoteChange: (note: string) => void;
  onTagChange: (field: string, value: string | null) => void;
}

const SessionRow: React.FC<RowProps> = ({
  entry, timeFormat, isEditing, tagsOpen, onEdit, onToggleTags,
  onSave, onCancel, onDelete, onNoteChange, onTagChange
}) => {
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  const handleEditStart = () => {
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

  const statusColor = STATUS_COLORS[entry.sessionStatus] || '#607D8B';

  if (isEditing) {
    return (
      <div className="session-row session-row--editing">
        <div className="session-row__edit-fields">
          <label>
            Start:
            <input type="datetime-local" value={startStr} onChange={e => setStartStr(e.target.value)} step="60" />
          </label>
          <label>
            End:
            <input type="datetime-local" value={endStr} onChange={e => setEndStr(e.target.value)} step="60" />
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
    <div className="session-row-wrapper">
      <div className="session-row">
        <div className="session-row__time">
          {formatTime(entry.startTime, timeFormat)} – {formatTime(entry.endTime!, timeFormat)}
        </div>
        <div className="session-row__task">{entry.taskName}</div>
        <div className="session-row__duration">
          {formatDuration(entry.duration ?? 0)}
        </div>
        {/* Status badge */}
        <span
          className="session-row__status-badge"
          style={{ backgroundColor: statusColor + '25', color: statusColor, borderColor: statusColor }}
        >
          {entry.isCompleted ? 'Done' : entry.sessionStatus || 'In Progress'}
        </span>
        <input
          className="session-row__note"
          type="text"
          placeholder="Add note..."
          value={entry.note}
          onChange={e => onNoteChange(e.target.value)}
        />
        <div className="session-row__actions">
          <button className="btn btn--icon" onClick={onToggleTags} title="Edit tags">
            &#9881;
          </button>
          <button className="btn btn--icon" onClick={handleEditStart} title="Edit times">
            &#9998;
          </button>
          <button className="btn btn--icon btn--icon-danger" onClick={onDelete} title="Delete">
            &#10005;
          </button>
        </div>
      </div>

      {/* Tag badges (always visible if tags exist) */}
      {(entry.projectId || entry.valueCategory || entry.workStyle) && !tagsOpen && (
        <div className="session-row__tag-badges">
          {entry.projectId && <span className="tag-badge" style={{ borderColor: '#4A90D9' }}>{entry.projectId}</span>}
          {entry.valueCategory && <span className="tag-badge" style={{ borderColor: '#50B86C' }}>{entry.valueCategory}</span>}
          {entry.workStyle && <span className="tag-badge" style={{ borderColor: '#9B59B6' }}>{entry.workStyle}</span>}
        </div>
      )}

      {/* Expandable tag editors */}
      {tagsOpen && (
        <div className="session-row__tags-panel">
          <TagSelector category="project" value={entry.projectId} onChange={v => onTagChange('projectId', v)} compact />
          <TagSelector category="value_category" value={entry.valueCategory} onChange={v => onTagChange('valueCategory', v)} compact />
          <TagSelector category="work_style" value={entry.workStyle} onChange={v => onTagChange('workStyle', v)} compact />
          <TagSelector category="output_type" value={entry.outputType} onChange={v => onTagChange('outputType', v)} compact />
          <TagSelector category="session_status" value={entry.sessionStatus} onChange={v => onTagChange('sessionStatus', v ?? 'In Progress')} compact allowClear={false} />
        </div>
      )}
    </div>
  );
};

function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
