// ============================================================
// V6 Panel Picker — fullscreen popup for selecting a work task
// Shows all work panels in V6 card style
// Active panel pinned to top with pulsing glow
// ============================================================

import React, { useEffect, useRef } from 'react';
import type { Task, TimeEntry } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration } from '../../utils/time';

interface Props {
  tasks: Task[];
  activeTaskId: string | null;
  activeEntry?: TimeEntry | null;
  todayDurations: Record<string, number>; // taskId -> total ms today
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

export const PanelPickerPopup: React.FC<Props> = ({
  tasks,
  activeTaskId,
  activeEntry,
  todayDurations,
  onSelect,
  onClose,
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Number keys 1-9 select task
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= tasks.length) {
        const sorted = getSortedTasks();
        if (sorted[num - 1]) {
          onSelect(sorted[num - 1].id);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tasks, onClose, onSelect]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Sort: active task first, then by order
  const getSortedTasks = () => {
    const sorted = [...tasks].sort((a, b) => a.order - b.order);
    if (activeTaskId) {
      const activeIdx = sorted.findIndex(t => t.id === activeTaskId);
      if (activeIdx > 0) {
        const [active] = sorted.splice(activeIdx, 1);
        sorted.unshift(active);
      }
    }
    return sorted;
  };

  const sortedTasks = getSortedTasks();

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a panel"
    >
      <div className="w-full max-w-lg mx-4 my-8 md:my-16 animate-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {activeTaskId ? 'Switch Panel' : 'Start Panel'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel list */}
        <div className="flex flex-col gap-3">
          {sortedTasks.map((task, idx) => (
            <PickerCard
              key={task.id}
              task={task}
              isActive={task.id === activeTaskId}
              activeEntry={task.id === activeTaskId ? activeEntry : null}
              todayDuration={todayDurations[task.id] || 0}
              index={idx}
              onSelect={onSelect}
            />
          ))}
        </div>

        {/* Tip */}
        <p className="text-center text-white/40 text-xs mt-6 mb-4">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 font-mono text-[11px]">1</kbd>–<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 font-mono text-[11px]">9</kbd> to quick-select · <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 font-mono text-[11px]">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
};

// ---- Individual card inside the picker ----

interface PickerCardProps {
  task: Task;
  isActive: boolean;
  activeEntry?: TimeEntry | null;
  todayDuration: number;
  index: number;
  onSelect: (taskId: string) => void;
}

const PickerCard: React.FC<PickerCardProps> = ({
  task,
  isActive,
  activeEntry,
  todayDuration,
  index,
  onSelect,
}) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const displayDuration = todayDuration + (isActive ? elapsed : 0);

  const hasTimer = task.timerMinutes > 0;
  const timerMs = task.timerMinutes * 60 * 1000;
  const isOvertime = hasTimer && isActive && elapsed > timerMs;

  return (
    <button
      onClick={() => onSelect(task.id)}
      className={`
        relative flex items-center gap-3 md:gap-4 w-full text-left
        rounded-2xl border transition-all duration-200
        ${isActive
          ? 'p-4 md:p-5 shadow-lg scale-[1.02] picker-card-glow'
          : 'p-3 md:p-4 bg-white hover:shadow-md hover:-translate-y-0.5 border-slate-200'
        }
      `}
      style={{
        borderColor: isActive ? `${task.color}60` : undefined,
        backgroundColor: isActive ? `${task.color}08` : 'white',
        '--glow-color': task.color,
      } as React.CSSProperties}
    >
      {/* Left color bar */}
      <div
        className={`rounded-full shrink-0 ${isActive ? 'w-2 h-14 md:h-16' : 'w-1.5 h-12 md:h-14'}`}
        style={{ backgroundColor: task.color }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`font-bold text-slate-900 truncate ${isActive ? 'text-base md:text-lg' : 'text-sm md:text-base'}`}>
            {task.name}
          </h3>
          {isActive && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: task.color }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: task.color }}
              >
                {isOvertime ? 'Overtime' : 'Active'}
              </span>
            </div>
          )}
        </div>

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
            className="text-xl md:text-2xl font-mono font-bold tabular-nums tracking-tight"
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

        {/* Keyboard shortcut */}
        {index < 9 && (
          <span className="hidden md:flex w-6 h-6 rounded-md bg-slate-100 text-slate-400 text-xs font-mono font-semibold items-center justify-center">
            {index + 1}
          </span>
        )}
      </div>
    </button>
  );
};
