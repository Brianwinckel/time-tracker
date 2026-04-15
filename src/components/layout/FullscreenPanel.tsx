// ============================================================
// V6 Fullscreen Panel — focused live work session view
// Only captures what is known DURING the session:
//   1. What am I working on?
//   2. What's happening with it right now?
//   3. When did this happen?
// Outcomes / reporting belong in the Summary Flow, not here.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration, formatTime } from '../../utils/time';
import { TagSelector } from '../TagSelector';
import type { Task, TimeEntry } from '../../types';

interface Props {
  task: Task;
  entry: TimeEntry;
  onClose: () => void;
}

const WORK_TYPES = ['Writing', 'Strategy', 'Research', 'Coding', 'Review', 'Revisions', 'Admin'];

export const FullscreenPanel: React.FC<Props> = ({ task, entry, onClose }) => {
  const { state, dispatch } = useApp();
  const elapsed = useTimer(entry.startTime);

  const [focusNote, setFocusNote] = useState(entry.note || '');
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>(
    entry.workStyle ? [entry.workStyle] : []
  );
  const [sessionNotes, setSessionNotes] = useState('');
  const [showCustomize, setShowCustomize] = useState(false);

  // Live session states — only conditions known during the session
  const [isBlocked, setIsBlocked] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [isRevisiting, setIsRevisiting] = useState(false);

  const hasTimer = task.timerMinutes > 0;
  const timerMs = task.timerMinutes * 60 * 1000;
  const isOvertime = hasTimer && elapsed > timerMs;

  const startTimeStr = formatTime(entry.startTime, '12h');

  // Compute elapsed hours/minutes for the duration display
  const elapsedDisplay = useMemo(() => {
    const totalMin = Math.floor(elapsed / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [elapsed]);

  // ---- Handlers ----

  const handlePause = () => {
    // Save context before pausing
    syncContext();
    dispatch({ type: 'STOP_TASK' });
    // Stay on fullscreen — shows paused state
  };

  const handleResume = () => {
    dispatch({ type: 'START_TASK', taskId: task.id, note: focusNote });
  };

  const handleEndSession = () => {
    syncContext();
    dispatch({ type: 'STOP_TASK' });
    onClose();
  };

  const syncContext = () => {
    if (focusNote !== entry.note) {
      dispatch({ type: 'SET_ENTRY_NOTE', entryId: entry.id, note: focusNote });
    }
    if (selectedWorkTypes.length > 0 && selectedWorkTypes[0] !== entry.workStyle) {
      dispatch({
        type: 'SET_ENTRY_TAGS',
        entryId: entry.id,
        tags: { workStyle: selectedWorkTypes[0] },
      });
    }
  };

  const handleNoteBlur = () => {
    if (focusNote !== entry.note) {
      dispatch({ type: 'SET_ENTRY_NOTE', entryId: entry.id, note: focusNote });
    }
  };

  const handleTagChange = (field: string, value: string | null) => {
    dispatch({
      type: 'SET_ENTRY_TAGS',
      entryId: entry.id,
      tags: { [field]: value },
    });
  };

  const toggleWorkType = (type: string) => {
    setSelectedWorkTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [type]
    );
  };

  // Is this entry still running?
  const isRunning = !entry.endTime;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* ---- Header ---- */}
      <header
        className="shrink-0 px-4 md:px-6 py-3 md:py-4 border-b flex items-center gap-3"
        style={{
          backgroundColor: `${task.color}06`,
          borderColor: `${task.color}15`,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          aria-label="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Color bar + name */}
        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
        <h1 className="text-base md:text-lg font-bold text-slate-900 flex-1 truncate">{task.name}</h1>

        {/* State label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`block w-2 h-2 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: isRunning ? (isOvertime ? '#ef4444' : task.color) : '#94a3b8' }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: isRunning ? (isOvertime ? '#ef4444' : task.color) : '#94a3b8' }}
          >
            {isRunning ? (isOvertime ? 'Overtime' : 'Active') : 'Paused'}
          </span>
        </div>

        {/* Timer */}
        <span
          className="text-xl md:text-2xl font-mono font-bold tabular-nums tracking-tight"
          style={{ color: isRunning ? (isOvertime ? '#ef4444' : task.color) : '#94a3b8' }}
        >
          {hasTimer && isOvertime
            ? `+${formatDuration(elapsed - timerMs)}`
            : formatDuration(elapsed)
          }
        </span>
      </header>

      {/* ---- Scrollable Content ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-6">

          {/* ---- Primary Actions ---- */}
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  Pause
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  End Session
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-colors"
                  style={{ backgroundColor: task.color }}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Resume
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:border-slate-300 transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>

          {/* ---- Time Controls ---- */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session Time</span>
              <span className="text-sm font-bold text-slate-700 font-mono tabular-nums">{elapsedDisplay}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Started</span>
              <span className="font-medium text-slate-600">{startTimeStr}</span>
            </div>

            {/* Timer progress bar */}
            {hasTimer && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, (elapsed / timerMs) * 100)}%`,
                      backgroundColor: isOvertime ? '#ef4444' : task.color,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{startTimeStr}</span>
                  <span>{task.timerMinutes}m target</span>
                </div>
              </div>
            )}
          </div>

          {/* ---- Work Context ---- */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Work Context</h3>

            {/* Project */}
            <TagSelector
              category="project"
              value={entry.projectId}
              onChange={v => handleTagChange('projectId', v)}
              compact={false}
            />

            {/* Focus note */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">What are you working on?</label>
              <input
                type="text"
                value={focusNote}
                onChange={e => setFocusNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="e.g. Building the new dashboard layout..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 bg-white"
              />
            </div>

            {/* Work type chips */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Work Type</label>
              <div className="flex flex-wrap gap-2">
                {WORK_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleWorkType(type)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150
                      ${selectedWorkTypes.includes(type)
                        ? 'font-semibold'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }
                    `}
                    style={selectedWorkTypes.includes(type) ? {
                      color: task.color,
                      borderColor: `${task.color}60`,
                      backgroundColor: `${task.color}08`,
                    } : undefined}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- Live Session State ---- */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">Session State</h3>
            <div className="flex flex-wrap gap-2">
              {/* Blocked */}
              <button
                onClick={() => setIsBlocked(!isBlocked)}
                className={`
                  px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all duration-150
                  ${isBlocked
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M18.364 5.636a9 9 0 11-12.728 0 9 9 0 0112.728 0zM6.343 6.343l11.314 11.314" />
                </svg>
                Blocked
              </button>

              {/* Needs Review */}
              <button
                onClick={() => setNeedsReview(!needsReview)}
                className={`
                  px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all duration-150
                  ${needsReview
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Needs Review
              </button>

              {/* Revisiting */}
              <button
                onClick={() => setIsRevisiting(!isRevisiting)}
                className={`
                  px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all duration-150
                  ${isRevisiting
                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Revisiting
              </button>
            </div>
          </div>

          {/* ---- Notes ---- */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</h3>
            <textarea
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              placeholder="Any quick notes about this session..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 bg-white resize-none"
            />
          </div>

          {/* ---- Customize Panel (collapsible) ---- */}
          <div>
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-500 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showCustomize ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
              Customize Panel
            </button>
            {showCustomize && (
              <div className="mt-3 space-y-4 pl-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-2">Color</label>
                  <div className="flex gap-2.5">
                    {['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#f43f5e', '#14b8a6', '#f59e0b', '#6366f1'].map(color => (
                      <button
                        key={color}
                        onClick={() => dispatch({ type: 'UPDATE_TASK', task: { ...task, color } })}
                        className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${task.color === color ? 'ring-2 ring-offset-2' : ''}`}
                        style={{ backgroundColor: color, '--tw-ring-color': color } as React.CSSProperties}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ---- Mobile Bottom Tab Bar ---- */}
      <nav className="md:hidden bg-white border-t border-slate-100 px-2 pb-[env(safe-area-inset-bottom,6px)] pt-2 flex items-center justify-around shrink-0">
        <button onClick={onClose} className="flex flex-col items-center gap-0.5 px-3 py-1 text-blue-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-[10px] font-medium">Tracker</span>
        </button>
        <button onClick={() => { onClose(); dispatch({ type: 'SET_VIEW', view: 'summary' }); }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[10px] font-medium">Summary</span>
        </button>
        <button onClick={() => { onClose(); dispatch({ type: 'SET_VIEW', view: 'manager' }); }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span className="text-[10px] font-medium">Team</span>
        </button>
        <button onClick={() => { onClose(); dispatch({ type: 'SET_VIEW', view: 'settings' }); }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </div>
  );
};
