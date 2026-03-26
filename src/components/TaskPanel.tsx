// ============================================================
// Single task card — large, colorful, clickable
// Shows countdown for timed tasks (Lunch, Break)
// Shows drag handle in reorder mode
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
  reorderMode?: boolean;
}

export const TaskPanel: React.FC<Props> = ({ task, isActive, index, onEdit, onStartTask, reorderMode }) => {
  const { getActiveEntry } = useApp();
  const activeEntry = getActiveEntry();
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const textColor = getContrastText(task.color);

  const hasTimer = task.timerMinutes > 0;
  const timerMs = task.timerMinutes * 60 * 1000;
  const remaining = hasTimer ? Math.max(0, timerMs - elapsed) : 0;
  const isOvertime = hasTimer && elapsed > timerMs;
  const overtimeMs = isOvertime ? elapsed - timerMs : 0;

  // Progress percentage for the countdown ring
  const progress = hasTimer && isActive ? Math.min(1, elapsed / timerMs) : 0;

  const handleClick = () => {
    if (reorderMode) return;
    onStartTask(task.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reorderMode) return;
    onEdit(task);
  };

  // Show timer badge when not active
  const timerBadge = hasTimer && !isActive && !reorderMode;

  return (
    <div
      className={`task-panel ${isActive ? 'task-panel--active' : ''} ${reorderMode ? 'task-panel--reorder' : ''} ${isOvertime ? 'task-panel--overtime' : ''}`}
      style={{
        backgroundColor: task.color,
        color: textColor,
        borderColor: isActive
          ? (isOvertime ? '#ff5252' : textColor)
          : 'transparent',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      title={reorderMode ? 'Drag to reorder' : `${task.name} (press ${index + 1})`}
    >
      {reorderMode && (
        <span className="task-panel__drag-handle" style={{ color: textColor }}>
          ⠿
        </span>
      )}

      <div className="task-panel__name">
        {task.name}
      </div>

      {/* Timer badge when not active */}
      {timerBadge && (
        <span className="task-panel__timer-badge" style={{ color: textColor }}>
          {task.timerMinutes}m
        </span>
      )}

      {isActive && !reorderMode && (
        <>
          {hasTimer ? (
            <div className="task-panel__countdown">
              {isOvertime ? (
                <>
                  <div className="task-panel__countdown-label" style={{ color: textColor }}>OVERTIME</div>
                  <div className="task-panel__timer task-panel__timer--overtime">
                    +{formatDuration(overtimeMs)}
                  </div>
                </>
              ) : (
                <>
                  <div className="task-panel__countdown-label" style={{ color: textColor }}>
                    {remaining > 0 ? 'remaining' : 'done'}
                  </div>
                  <div className="task-panel__timer">
                    {formatDuration(remaining)}
                  </div>
                  {/* Progress bar */}
                  <div className="task-panel__progress" style={{ opacity: 0.3 }}>
                    <div
                      className="task-panel__progress-fill"
                      style={{
                        width: `${progress * 100}%`,
                        backgroundColor: textColor,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="task-panel__timer">{formatDuration(elapsed)}</div>
          )}
          {activeEntry?.note && (
            <div className="task-panel__note">{activeEntry.note}</div>
          )}
        </>
      )}

      {!reorderMode && index < 9 && (
        <span className="task-panel__shortcut" style={{ color: textColor }}>
          {index + 1}
        </span>
      )}

      {!reorderMode && (
        <button
          className="task-panel__edit"
          onClick={handleEdit}
          style={{ color: textColor }}
          title="Edit task"
        >
          &#9998;
        </button>
      )}
    </div>
  );
};
