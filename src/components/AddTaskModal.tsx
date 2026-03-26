// ============================================================
// Modal for adding a new custom task
// ============================================================

import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useApp } from '../context/AppContext';
import { TASK_COLORS, getNextColor } from '../utils/colors';

interface Props {
  onClose: () => void;
}

export const AddTaskModal: React.FC<Props> = ({ onClose }) => {
  const { state, dispatch } = useApp();
  const usedColors = state.tasks.map(t => t.color);

  const [name, setName] = useState('');
  const [color, setColor] = useState(getNextColor(usedColors));
  const [isPinned, setIsPinned] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    dispatch({
      type: 'ADD_TASK',
      task: {
        id: uuid(),
        name: name.trim(),
        color,
        isDefault: false,
        isPinned,
        createdAt: new Date().toISOString(),
        order: state.tasks.length,
        timerMinutes,
      },
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add New Task</h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Task Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Code Review"
              autoFocus
              maxLength={30}
            />
          </label>

          <label className="field">
            <span>Color</span>
            <div className="color-picker">
              {TASK_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${c === color ? 'color-swatch--selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </label>

          <label className="field">
            <span>Timer (minutes)</span>
            <input
              type="number"
              value={timerMinutes}
              onChange={e => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              max={480}
              step={5}
            />
            <small className="field__hint">Set a countdown timer with push reminder (0 = no timer)</small>
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={e => setIsPinned(e.target.checked)}
            />
            <span>Pin task (persists permanently)</span>
          </label>

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
