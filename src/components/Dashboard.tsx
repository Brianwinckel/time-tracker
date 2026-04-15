// ============================================================
// V6 Dashboard — "Today's Panels" home screen
// Purpose: overview of today's work, quick switching, launch work
// Answers: "What am I working on right now, or what do I want to switch to?"
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements, canUseFeature, getFeatureLimit } from '../billing/entitlements';
import { useTimer } from '../hooks/useTimer';
import { formatDuration } from '../utils/time';
import { PanelPickerPopup } from './layout/PanelPickerPopup';
import { FullscreenPanel } from './layout/FullscreenPanel';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { UpgradePrompt } from './billing/UpgradePrompt';
import type { Task, TimeEntry } from '../types';

const BREAK_TASK_NAMES = ['break', 'lunch'];

export const Dashboard: React.FC = () => {
  const { state, dispatch, getActiveEntry } = useApp();
  const { profile } = useAuth();
  const { entitlements } = useEntitlements();

  const [showPicker, setShowPicker] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const activeEntry = getActiveEntry();
  const activeTask = state.tasks.find(t => t.id === activeEntry?.taskId);
  const isActiveBreak = activeEntry && BREAK_TASK_NAMES.includes((activeTask?.name || '').toLowerCase());

  // Split tasks
  const sortedTasks = useMemo(
    () => [...state.tasks].sort((a, b) => a.order - b.order),
    [state.tasks]
  );
  const workTasks = useMemo(
    () => sortedTasks.filter(t => !BREAK_TASK_NAMES.includes(t.name.toLowerCase())),
    [sortedTasks]
  );
  const breakTasks = useMemo(
    () => sortedTasks.filter(t => BREAK_TASK_NAMES.includes(t.name.toLowerCase())),
    [sortedTasks]
  );

  // Per-task aggregates for today
  const taskSummaries = useMemo(() => {
    const summaries: Record<string, { totalMs: number; sessionCount: number; completedCount: number }> = {};
    for (const entry of state.entries) {
      if (!summaries[entry.taskId]) {
        summaries[entry.taskId] = { totalMs: 0, sessionCount: 0, completedCount: 0 };
      }
      summaries[entry.taskId].sessionCount++;
      if (entry.endTime && entry.duration) {
        summaries[entry.taskId].totalMs += entry.duration;
        summaries[entry.taskId].completedCount++;
      }
    }
    return summaries;
  }, [state.entries]);

  // Total tracked time today
  const totalTrackedMs = useMemo(
    () => Object.values(taskSummaries).reduce((sum, s) => sum + s.totalMs, 0),
    [taskSummaries]
  );

  // Panels that have activity today (or are currently active)
  const activePanels = useMemo(() => {
    const panelIds = new Set<string>();
    for (const entry of state.entries) {
      if (!BREAK_TASK_NAMES.includes((state.tasks.find(t => t.id === entry.taskId)?.name || '').toLowerCase())) {
        panelIds.add(entry.taskId);
      }
    }
    if (activeEntry && !isActiveBreak) panelIds.add(activeEntry.taskId);
    return workTasks.filter(t => panelIds.has(t.id));
  }, [state.entries, activeEntry, workTasks, isActiveBreak, state.tasks]);

  // Sort: active task first
  const sortedPanels = useMemo(() => {
    if (!activeEntry || isActiveBreak) return activePanels;
    const sorted = [...activePanels];
    const activeIdx = sorted.findIndex(t => t.id === activeEntry.taskId);
    if (activeIdx > 0) {
      const [active] = sorted.splice(activeIdx, 1);
      sorted.unshift(active);
    }
    return sorted;
  }, [activePanels, activeEntry, isActiveBreak]);

  // Auto-open fullscreen when a work task starts
  const prevActiveRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevActiveRef.current;
    prevActiveRef.current = state.activeEntryId;

    if (!prevId && state.activeEntryId) {
      const task = state.tasks.find(t => t.id === activeEntry?.taskId);
      if (task && !BREAK_TASK_NAMES.includes(task.name.toLowerCase())) {
        setShowFullscreen(true);
      }
    }
  }, [state.activeEntryId]);

  // ---- Handlers ----

  const handlePickerSelect = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (activeEntry?.taskId === taskId) {
      dispatch({ type: 'STOP_TASK' });
      setShowPicker(false);
      return;
    }

    dispatch({ type: 'START_TASK', taskId });
    setShowPicker(false);
  };

  const handleBreakToggle = (taskId: string) => {
    dispatch({ type: 'START_TASK', taskId });
  };

  const handlePanelCardClick = (taskId: string) => {
    if (activeEntry?.taskId === taskId) {
      setShowFullscreen(true);
    }
  };

  const handleAddTask = () => {
    const customCount = state.tasks.filter(t => !t.isDefault).length;
    const unlimited = canUseFeature(entitlements.features, 'unlimited_panels');
    const maxPanels = getFeatureLimit(entitlements.features, 'max_custom_panels');
    if (!unlimited && customCount >= maxPanels) {
      setShowUpgrade(true);
    } else {
      setShowAdd(true);
    }
  };

  const userName = state.settings.myName || profile?.name;
  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400" role="status" aria-busy="true">
        Loading...
      </div>
    );
  }

  const hasCompletedEntries = state.entries.some(e => e.endTime);
  const hasActiveWorkTask = activeEntry && activeTask && !isActiveBreak;

  // ---- Fullscreen Panel View ----
  if (showFullscreen && activeEntry && activeTask && !isActiveBreak) {
    return (
      <FullscreenPanel
        task={activeTask}
        entry={activeEntry}
        onClose={() => setShowFullscreen(false)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6 space-y-4">

      {/* ---- Header ---- */}
      <div className="flex items-center gap-3 mb-1">
        <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0 hidden md:block">
          <circle cx="10" cy="10" r="5" fill="#3b82f6" />
          <circle cx="22" cy="10" r="5" fill="#f97316" />
          <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
          <circle cx="22" cy="22" r="5" fill="#10b981" />
        </svg>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex-1">Today's Panels</h1>

        <button
          onClick={handleAddTask}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
          title="Add new task panel"
          aria-label="Add panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
          className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0"
          aria-label="Settings"
        >
          {initials}
        </button>
      </div>

      {/* ---- Filter Tabs ---- */}
      <div className="flex items-center gap-1 border-b border-slate-100 -mx-4 px-4">
        {(['today', 'week', 'archive'] as const).map(tab => (
          <button
            key={tab}
            className={`
              px-4 py-2 text-sm font-medium transition-colors relative
              ${tab === 'today' ? 'text-slate-900' : 'text-slate-300 cursor-default'}
            `}
            disabled={tab !== 'today'}
          >
            {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : 'Archive'}
            {tab === 'today' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ---- Panel Summary Cards ---- */}
      <div className="space-y-3">
        {sortedPanels.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No panels started yet today.
          </div>
        )}

        {sortedPanels.map(task => {
          const isActive = activeEntry?.taskId === task.id;
          const summary = taskSummaries[task.id] || { totalMs: 0, sessionCount: 0, completedCount: 0 };
          return (
            <PanelSummaryCard
              key={task.id}
              task={task}
              isActive={isActive}
              activeEntry={isActive ? activeEntry : undefined}
              totalMs={summary.totalMs}
              sessionCount={summary.sessionCount}
              completedCount={summary.completedCount}
              onClick={() => handlePanelCardClick(task.id)}
            />
          );
        })}
      </div>

      {/* ---- Break / Lunch Cards ---- */}
      <div className="grid grid-cols-2 gap-3">
        {breakTasks.map(task => (
          <BreakCard
            key={task.id}
            task={task}
            isActive={activeEntry?.taskId === task.id}
            activeEntry={activeEntry?.taskId === task.id ? activeEntry : undefined}
            onClick={() => handleBreakToggle(task.id)}
          />
        ))}
      </div>

      {/* ---- Action Buttons ---- */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          {hasActiveWorkTask ? 'Switch Panel' : 'Start Panel'}
        </button>

        <button
          onClick={() => hasCompletedEntries && dispatch({ type: 'SET_VIEW', view: 'prepare-summary' })}
          className={`
            flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border transition-all
            ${hasCompletedEntries
              ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-sm cursor-pointer'
              : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
            }
          `}
        >
          Generate Summary
        </button>
      </div>

      {/* ---- Today's Sessions summary line ---- */}
      {hasCompletedEntries && (
        <div className="flex items-center justify-between px-1 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Today's Sessions
          </span>
          <span className="text-xs font-mono font-semibold text-slate-400 tabular-nums">
            {formatDuration(totalTrackedMs)} total
          </span>
        </div>
      )}

      {/* ---- Modals ---- */}
      {showPicker && (
        <PanelPickerPopup
          tasks={workTasks}
          activeTaskId={activeEntry?.taskId ?? null}
          activeEntry={activeEntry}
          todayDurations={Object.fromEntries(
            Object.entries(taskSummaries).map(([id, s]) => [id, s.totalMs])
          )}
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} />}
      {editingTask && (
        <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      {showUpgrade && (
        <UpgradePrompt
          feature="unlimited_panels"
          currentPlan={entitlements.plan}
          onClose={() => setShowUpgrade(false)}
          context={`You've reached the ${getFeatureLimit(entitlements.features, 'max_custom_panels')} custom panel limit on the Free plan.`}
        />
      )}
    </div>
  );
};

// ============================================================
// Panel Summary Card — today's aggregate for one task
// ============================================================

interface PanelSummaryCardProps {
  task: Task;
  isActive: boolean;
  activeEntry?: TimeEntry;
  totalMs: number;
  sessionCount: number;
  completedCount: number;
  onClick: () => void;
}

const PanelSummaryCard: React.FC<PanelSummaryCardProps> = ({
  task, isActive, activeEntry, totalMs, sessionCount, completedCount, onClick,
}) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const displayMs = totalMs + (isActive ? elapsed : 0);

  const subtitle = sessionCount === 0
    ? ''
    : completedCount > 0
    ? `${sessionCount} task${sessionCount !== 1 ? 's' : ''} — ${completedCount} completed`
    : `${sessionCount} task${sessionCount !== 1 ? 's' : ''}`;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left flex items-center gap-3 md:gap-4 p-4 md:p-5
        rounded-2xl border transition-all duration-200
        ${isActive
          ? 'active-panel-glow cursor-pointer'
          : 'cursor-default'
        }
      `}
      style={{
        borderColor: `${task.color}${isActive ? '50' : '30'}`,
        backgroundColor: `${task.color}${isActive ? '06' : '03'}`,
        '--glow-color': task.color,
      } as React.CSSProperties}
    >
      {/* Left color bar */}
      <div
        className="w-1.5 h-14 md:h-16 rounded-full shrink-0"
        style={{ backgroundColor: task.color }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base md:text-lg font-bold text-slate-900 truncate">{task.name}</h3>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Timer + Active badge */}
      <div className="text-right shrink-0">
        <span
          className={`font-mono font-bold tabular-nums tracking-tight block ${
            isActive ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'
          }`}
          style={{ color: task.color }}
        >
          {formatDuration(displayMs)}
        </span>
        {isActive && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span
              className="block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: task.color }}
            />
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: task.color }}
            >
              Active
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

// ============================================================
// Break Card — wider format for break/lunch
// ============================================================

interface BreakCardProps {
  task: Task;
  isActive: boolean;
  activeEntry?: TimeEntry;
  onClick: () => void;
}

const BreakCard: React.FC<BreakCardProps> = ({ task, isActive, activeEntry, onClick }) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const isLunch = task.name.toLowerCase() === 'lunch';
  const timerMs = task.timerMinutes * 60 * 1000;
  const isOvertime = timerMs > 0 && elapsed > timerMs;
  const remaining = timerMs > 0 && isActive ? Math.max(0, timerMs - elapsed) : 0;

  const icon = isLunch ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zM3 18h18M5 18V8a7 7 0 0114 0v10" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 hover:shadow-sm"
      style={{
        backgroundColor: isActive ? (isOvertime ? '#fef2f220' : `${task.color}12`) : `${task.color}06`,
        borderColor: isActive ? (isOvertime ? '#fca5a5' : `${task.color}40`) : `${task.color}25`,
      }}
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${task.color}15`, color: task.color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0 text-left">
        <span className="text-sm font-semibold text-slate-700 block">{task.name}</span>
        {isActive ? (
          <span className="text-xs font-mono font-bold tabular-nums" style={{ color: isOvertime ? '#ef4444' : task.color }}>
            {timerMs > 0 && !isOvertime ? formatDuration(remaining) : isOvertime ? `+${formatDuration(elapsed - timerMs)}` : formatDuration(elapsed)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">{task.timerMinutes} min</span>
        )}
      </div>
    </button>
  );
};
