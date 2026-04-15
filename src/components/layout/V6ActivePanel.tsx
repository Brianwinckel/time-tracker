// ============================================================
// V6 Active Panel — hero card for the currently running task
// Larger than picker cards, with slow pulsing glow
// Shown prominently at top of dashboard when a task is active
// ============================================================

import React, { useState } from 'react';
import type { Task, TimeEntry, AppState } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration } from '../../utils/time';
import { TagSelector } from '../TagSelector';

interface Props {
  task: Task;
  activeEntry: TimeEntry;
  todayDuration: number;
  onStop: () => void;
  onSwitch: () => void;
  onTagChange: (field: string, value: string | null) => void;
}

export const V6ActivePanel: React.FC<Props> = ({
  task,
  activeEntry,
  todayDuration,
  onStop,
  onSwitch,
  onTagChange,
}) => {
  const elapsed = useTimer(activeEntry.startTime);
  const [tagsOpen, setTagsOpen] = useState(false);

  const hasTimer = task.timerMinutes > 0;
  const timerMs = task.timerMinutes * 60 * 1000;
  const isOvertime = hasTimer && elapsed > timerMs;
  const totalToday = todayDuration + elapsed;

  return (
    <div
      className={`
        relative rounded-2xl border-2 p-5 md:p-6
        transition-all duration-300 active-panel-glow
        ${isOvertime ? 'ring-2 ring-red-300' : ''}
      `}
      style={{
        borderColor: `${task.color}50`,
        backgroundColor: `${task.color}06`,
        '--glow-color': task.color,
      } as React.CSSProperties}
    >
      {/* Top row: color bar + task info + timer */}
      <div className="flex items-start gap-4">
        {/* Left color bar */}
        <div
          className="w-2 h-16 md:h-20 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: task.color }}
        />

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate">{task.name}</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: task.color }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: isOvertime ? '#ef4444' : task.color }}
              >
                {isOvertime ? 'Overtime' : 'Active'}
              </span>
            </div>
          </div>

          {activeEntry.note && (
            <p className="text-sm text-slate-400 truncate mb-1">{activeEntry.note}</p>
          )}

          {/* Tag badges */}
          {(activeEntry.projectId || activeEntry.valueCategory) && (
            <div className="flex items-center gap-1.5 mt-1">
              {activeEntry.projectId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  {activeEntry.projectId}
                </span>
              )}
              {activeEntry.valueCategory && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  {activeEntry.valueCategory}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="text-right shrink-0">
          <span
            className="text-2xl md:text-4xl font-mono font-bold tabular-nums tracking-tight block"
            style={{ color: isOvertime ? '#ef4444' : task.color }}
          >
            {hasTimer && isOvertime
              ? `+${formatDuration(elapsed - timerMs)}`
              : formatDuration(elapsed)
            }
          </span>
          {totalToday > elapsed && (
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {formatDuration(totalToday)} today
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: `${task.color}15` }}>
        <button
          onClick={onStop}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          title="Stop (Esc)"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stop
        </button>

        <button
          onClick={onSwitch}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Switch Panel
        </button>

        <button
          onClick={() => setTagsOpen(!tagsOpen)}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all
            ${tagsOpen
              ? 'border-slate-300 bg-slate-50 text-slate-700'
              : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300'
            }
          `}
          title="Tag this session"
          aria-expanded={tagsOpen}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Tags
        </button>

        {/* Spacer + keyboard hint */}
        <span className="hidden md:flex ml-auto text-xs text-slate-300 items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[11px] text-slate-400">Esc</kbd> stop
        </span>
      </div>

      {/* Expandable tags */}
      {tagsOpen && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          <TagSelector
            category="project"
            value={activeEntry.projectId}
            onChange={v => onTagChange('projectId', v)}
            compact
          />
          <TagSelector
            category="value_category"
            value={activeEntry.valueCategory}
            onChange={v => onTagChange('valueCategory', v)}
            compact
          />
          <TagSelector
            category="work_style"
            value={activeEntry.workStyle}
            onChange={v => onTagChange('workStyle', v)}
            compact
          />
        </div>
      )}
    </div>
  );
};
