// ============================================================
// V6 Panel Card — colorful row card with left color bar
// Replaces the old grid-based TaskPanel with the V6 list layout
// Matches taskpanels.app/concepts/v6-panel-cards.html
// ============================================================

import React from 'react';
import type { Task, TimeEntry } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration } from '../../utils/time';

interface Props {
  task: Task;
  isActive: boolean;
  activeEntry?: TimeEntry | null;
  todayDuration: number; // total ms tracked today for this task
  index: number;
  onStartTask: (taskId: string) => void;
  onEdit: (task: Task) => void;
  reorderMode?: boolean;
}

export const PanelCard: React.FC<Props> = ({
  task,
  isActive,
  activeEntry,
  todayDuration,
  index,
  onStartTask,
  onEdit,
  reorderMode,
}) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);

  const hasTimer = task.timerMinutes > 0;
  const timerMs = task.timerMinutes * 60 * 1000;
  const isOvertime = hasTimer && isActive && elapsed > timerMs;

  // Total display time: completed sessions + live elapsed
  const displayDuration = todayDuration + (isActive ? elapsed : 0);

  const handleClick = () => {
    if (reorderMode) return;
    onStartTask(task.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reorderMode) return;
    onEdit(task);
  };

  // Color mappings for accent shading
  const bgColor = isActive ? `${task.color}08` : 'white';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      className={`
        group relative flex items-center gap-3 md:gap-4
        bg-white rounded-2xl border p-3 md:p-4
        transition-all duration-200 cursor-pointer
        ${isActive
          ? 'border-current shadow-sm'
          : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md'
        }
        ${reorderMode ? 'border-dashed border-slate-300' : ''}
        ${isOvertime ? 'ring-2 ring-red-300' : ''}
      `}
      style={{
        borderColor: isActive ? `${task.color}60` : undefined,
        backgroundColor: bgColor,
      }}
    >
      {/* Drag handle (reorder mode) */}
      {reorderMode && (
        <span className="text-slate-400 text-lg leading-none shrink-0 cursor-grab">⠿</span>
      )}

      {/* Left color bar */}
      <div
        className="w-1.5 md:w-2 h-12 md:h-14 rounded-full shrink-0"
        style={{ backgroundColor: task.color }}
      />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm md:text-base font-bold text-slate-900 truncate">{task.name}</h3>

          {/* Active indicator */}
          {isActive && !reorderMode && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: task.color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: task.color }}>
                {isOvertime ? 'Overtime' : 'Active'}
              </span>
            </div>
          )}
        </div>

        {/* Subtitle: note or timer info */}
        {isActive && activeEntry?.note && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{activeEntry.note}</p>
        )}
        {!isActive && hasTimer && (
          <p className="text-xs text-slate-400 mt-0.5">{task.timerMinutes}m timer</p>
        )}
      </div>

      {/* Timer / Duration */}
      <div className="flex items-center gap-3 shrink-0">
        {isActive ? (
          <span
            className="text-lg md:text-2xl font-mono font-bold tabular-nums tracking-tight"
            style={{ color: isOvertime ? '#ef4444' : task.color }}
          >
            {hasTimer && isOvertime
              ? `+${formatDuration(elapsed - timerMs)}`
              : formatDuration(elapsed)
            }
          </span>
        ) : displayDuration > 0 ? (
          <span className="text-sm md:text-base font-mono font-semibold text-slate-400 tabular-nums">
            {formatDuration(displayDuration)}
          </span>
        ) : null}

        {/* Keyboard shortcut (desktop) */}
        {!reorderMode && index < 9 && (
          <span className="hidden md:flex w-6 h-6 rounded-md bg-slate-100 text-slate-400 text-xs font-mono font-semibold items-center justify-center">
            {index + 1}
          </span>
        )}
      </div>

      {/* Edit button — revealed on hover */}
      {!reorderMode && (
        <button
          onClick={handleEdit}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          title="Edit task"
          aria-label={`Edit ${task.name}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  );
};
