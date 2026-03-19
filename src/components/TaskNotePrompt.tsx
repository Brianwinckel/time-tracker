// ============================================================
// Quick note prompt — appears when starting a task
// Lets you add specificity like "Editing → client proposal Q2"
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import type { Task } from '../types';
import { getContrastText } from '../utils/colors';

interface Props {
  task: Task;
  onConfirm: (note: string) => void;
  onSkip: () => void;
}

export const TaskNotePrompt: React.FC<Props> = ({ task, onConfirm, onSkip }) => {
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(note.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onSkip();
    }
  };

  const textColor = getContrastText(task.color);

  return (
    <div className="note-prompt-overlay" onClick={onSkip}>
      <div
        className="note-prompt"
        onClick={e => e.stopPropagation()}
        style={{ borderTopColor: task.color }}
      >
        <div className="note-prompt__header">
          <span
            className="note-prompt__badge"
            style={{ backgroundColor: task.color, color: textColor }}
          >
            {task.name}
          </span>
          <span className="note-prompt__label">What specifically?</span>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="note-prompt__input"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`e.g. "${task.name === 'Editing' ? 'Client proposal Q2' : task.name === 'Meetings' ? 'Weekly standup' : task.name === 'Email' ? 'Follow-ups from yesterday' : 'Details...'}"`}
            maxLength={80}
          />
          <div className="note-prompt__actions">
            <button type="button" className="btn btn--secondary btn--small" onClick={onSkip}>
              Skip
            </button>
            <button type="submit" className="btn btn--primary btn--small">
              Start {task.name}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
