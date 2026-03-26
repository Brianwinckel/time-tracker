// ============================================================
// Modal for editing or deleting an existing task
// ============================================================

import React, { useState } from 'react';
import type { Task } from '../types';
import { useApp } from '../context/AppContext';
import { TASK_COLORS } from '../utils/colors';

interface Props {
  task: Task;
  onClose: () => void;
}

export const EditTaskModal: React.FC<Props> = ({ task, onClose }) => {
  const { dispatch } = useApp();
  const [name, setName] = useState(task.name);
  const [color, setColor] = useState(task.color);
  const [isPinned, setIsPinned] = useState(task.isPinned);
  const [timerMinutes, setTimerMinutes] = useState(task.timerMinutes ?? 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    dispatch({
      type: 'UPDATE_TASK',
      task: { ...task, name: name.trim(), color, isPinned, timerMinutes },
    });
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    dispatch({ type: 'DELETE_TASK', taskId: task.id });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Edit Task</h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Task Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
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
            <small className="field__hint">Set to 0 for no timer. Tasks with a timer will show a countdown and send a push reminder when time is up.</small>
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
            <button
              type="button"
              className={`btn ${confirmDelete ? 'btn--danger' : 'btn--danger-outline'}`}
              onClick={handleDelete}
            >
              {confirmDelete ? 'Confirm Delete' : 'Delete Task'}
            </button>
            <div className="modal__actions-right">
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
