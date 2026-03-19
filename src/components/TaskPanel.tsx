// ============================================================
// Single task card — large, colorful, clickable
// ============================================================

import React from 'react';
import type { Task } from '../types';
import { getContrastText } from '../utils/colors';
import { useApp } from '../context/AppContext';
import { useTimer } from '../hooks/useTimer';
import { formatDuration } from '../utils/time';

interface Props {
  task: Task;
  isActive: boolean;
  index: number;
  onEdit: (task: Task) => void;
  onStartTask: (taskId: string) => void;
}

export const TaskPanel: React.FC<Props> = ({ task, isActive, index, onEdit, onStartTask }) => {
  const { getActiveEntry } = useApp();
  const activeEntry = getActiveEntry();
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const textColor = getContrastText(task.color);

  const handleClick = () => {
    onStartTask(task.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(task);
  };

  return (
    <div
      className={`task-panel ${isActive ? 'task-panel--active' : ''}`}
      style={{
        backgroundColor: task.color,
        color: textColor,
        borderColor: isActive ? textColor : 'transparent',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      title={`${task.name} (press ${index + 1})`}
    >
      <div className="task-panel__name">{task.name}</div>

      {isActive && (
        <>
          <div className="task-panel__timer">{formatDuration(elapsed)}</div>
          {activeEntry?.note && (
            <div className="task-panel__note">{activeEntry.note}</div>
          )}
        </>
      )}

      {index < 9 && (
        <span className="task-panel__shortcut" style={{ color: textColor }}>
          {index + 1}
        </span>
      )}

      <button
        className="task-panel__edit"
        onClick={handleEdit}
        style={{ color: textColor }}
        title="Edit task"
      >
        &#9998;
      </button>
    </div>
  );
};
