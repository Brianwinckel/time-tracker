// ============================================================
// V6 Break/Lunch Buttons — compact utility buttons
// Always visible on the dashboard (not hidden behind picker)
// ============================================================

import React from 'react';
import type { Task, TimeEntry } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration } from '../../utils/time';

interface Props {
  breakTasks: Task[];
  activeEntry?: TimeEntry | null;
  onToggle: (taskId: string) => void;
}

export const V6BreakButtons: React.FC<Props> = ({ breakTasks, activeEntry, onToggle }) => {
  if (breakTasks.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {breakTasks.map(task => (
        <BreakChip
          key={task.id}
          task={task}
          isActive={activeEntry?.taskId === task.id}
          activeEntry={activeEntry?.taskId === task.id ? activeEntry : undefined}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

// ---- Individual break chip ----

interface BreakChipProps {
  task: Task;
  isActive: boolean;
  activeEntry?: TimeEntry;
  onToggle: (taskId: string) => void;
}

const BreakChip: React.FC<BreakChipProps> = ({ task, isActive, activeEntry, onToggle }) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const isLunch = task.name.toLowerCase() === 'lunch';
  const icon = isLunch ? '🍽️' : '☕';
  const timerMs = task.timerMinutes * 60 * 1000;
  const remaining = timerMs > 0 && isActive ? Math.max(0, timerMs - elapsed) : 0;
  const isOvertime = timerMs > 0 && elapsed > timerMs;

  return (
    <button
      onClick={() => onToggle(task.id)}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium
        transition-all duration-200
        ${isActive
          ? isOvertime
            ? 'bg-red-50 border-red-200 text-red-700 shadow-sm'
            : 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm'
        }
      `}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{task.name}</span>
      {isActive && (
        <span className="font-mono text-xs tabular-nums font-bold">
          {timerMs > 0 && !isOvertime
            ? formatDuration(remaining)
            : isOvertime
            ? `+${formatDuration(elapsed - timerMs)}`
            : formatDuration(elapsed)
          }
        </span>
      )}
      {!isActive && task.timerMinutes > 0 && (
        <span className="text-xs text-slate-400">{task.timerMinutes}m</span>
      )}
    </button>
  );
};
