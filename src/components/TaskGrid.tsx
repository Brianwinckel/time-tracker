// ============================================================
// Grid of task panels — drag-and-drop reordering
// Long-press on mobile, click-drag on desktop
// ============================================================

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTimer } from '../hooks/useTimer';
import { TaskPanel } from './TaskPanel';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { TaskNotePrompt } from './TaskNotePrompt';
import { UpgradePrompt } from './billing/UpgradePrompt';
import { useEntitlements, canUseFeature, getFeatureLimit } from '../billing/entitlements';
import { formatDuration } from '../utils/time';
import type { Task } from '../types';

// Names that indicate break/lunch — separated from main task grid
const BREAK_TASK_NAMES = ['break', 'lunch'];

const LONG_PRESS_MS = 400;

export const TaskGrid: React.FC = () => {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [promptTask, setPromptTask] = useState<Task | null>(null);
  const { entitlements } = useEntitlements();

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeEntry = state.entries.find(e => e.id === state.activeEntryId);
  const sortedTasks = [...state.tasks].sort((a, b) => a.order - b.order);

  // Split tasks: work tasks in the grid, break/lunch in the utility row
  const workTasks = sortedTasks.filter(t => !BREAK_TASK_NAMES.includes(t.name.toLowerCase()));
  const breakTasks = sortedTasks.filter(t => BREAK_TASK_NAMES.includes(t.name.toLowerCase()));

  // Build display order: if dragging, reorder preview (work tasks only)
  const displayTasks = useMemo(() => {
    if (!dragId || !overId || dragId === overId) return workTasks;
    const items = workTasks.filter(t => t.id !== dragId);
    const draggedTask = workTasks.find(t => t.id === dragId);
    if (!draggedTask) return workTasks;
    const overIdx = items.findIndex(t => t.id === overId);
    if (overIdx < 0) return workTasks;
    items.splice(overIdx, 0, draggedTask);
    return items;
  }, [workTasks, dragId, overId]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const commitReorder = useCallback(() => {
    if (dragId && overId && dragId !== overId) {
      const items = workTasks.filter(t => t.id !== dragId);
      const draggedTask = workTasks.find(t => t.id === dragId);
      if (draggedTask) {
        const overIdx = items.findIndex(t => t.id === overId);
        if (overIdx >= 0) {
          items.splice(overIdx, 0, draggedTask);
          // Combine reordered work tasks with break tasks at the end
          const allIds = [...items.map(t => t.id), ...breakTasks.map(t => t.id)];
          dispatch({ type: 'REORDER_TASKS', taskIds: allIds });
        }
      }
    }
    setDragId(null);
    setOverId(null);
  }, [dragId, overId, workTasks, breakTasks, dispatch]);

  // ---- Desktop drag & drop (HTML5) ----
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (!isReorderMode) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setDragId(taskId);
    didDrag.current = true;
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (taskId !== overId) setOverId(taskId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    commitReorder();
  };

  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  // ---- Touch: long-press to enter reorder, then drag ----
  const handleTouchStart = (e: React.TouchEvent, taskId: string) => {
    const touch = e.touches[0];
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    didDrag.current = false;

    if (isReorderMode) {
      // Already in reorder mode — start dragging immediately
      setDragId(taskId);
      didDrag.current = true;
      e.preventDefault(); // prevent scroll while dragging
    } else {
      // Start long-press timer to enter reorder mode
      longPressTimer.current = setTimeout(() => {
        setIsReorderMode(true);
        setDragId(taskId);
        didDrag.current = true;
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(30);
      }, LONG_PRESS_MS);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const start = dragStartPos.current;

    // If not yet in reorder mode and moved too far, cancel long-press
    if (!isReorderMode && start) {
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    }

    if (dragId && gridRef.current) {
      e.preventDefault();
      // Find element under touch
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const panel = el.closest('[data-task-id]') as HTMLElement | null;
        if (panel) {
          const id = panel.dataset.taskId!;
          if (id !== overId) setOverId(id);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (dragId) {
      commitReorder();
    }
  };

  // Click outside or tap "Done" to exit reorder mode
  useEffect(() => {
    if (!isReorderMode) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!gridRef.current?.contains(target) && !target.closest('.reorder-done-btn')) {
        setIsReorderMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isReorderMode]);

  // ---- Task click (only fire if not dragging) ----
  const handleTaskClick = (taskId: string) => {
    if (didDrag.current || isReorderMode) return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Toggle off if clicking the active task
    if (activeEntry?.taskId === taskId) {
      dispatch({ type: 'START_TASK', taskId });
      return;
    }

    // Break/Lunch tasks start immediately — no note prompt
    if (BREAK_TASK_NAMES.includes(task.name.toLowerCase())) {
      dispatch({ type: 'START_TASK', taskId });
      return;
    }

    setPromptTask(task);
  };

  const handleNoteConfirm = (note: string) => {
    if (promptTask) {
      dispatch({ type: 'START_TASK', taskId: promptTask.id, note });
    }
    setPromptTask(null);
  };

  const handleNoteSkip = () => {
    if (promptTask) {
      dispatch({ type: 'START_TASK', taskId: promptTask.id });
    }
    setPromptTask(null);
  };

  return (
    <>
      {isReorderMode && (
        <div className="reorder-banner">
          <span>Drag tiles to reorder</span>
          <button
            className="reorder-done-btn"
            onClick={() => setIsReorderMode(false)}
          >
            Done
          </button>
        </div>
      )}

      <div className="task-grid" ref={gridRef} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {displayTasks.map((task, idx) => (
          <div
            key={task.id}
            data-task-id={task.id}
            className={`task-grid__slot ${
              dragId === task.id ? 'task-grid__slot--dragging' : ''
            } ${overId === task.id && dragId !== task.id ? 'task-grid__slot--over' : ''} ${
              isReorderMode ? 'task-grid__slot--reorder' : ''
            }`}
            draggable={isReorderMode}
            onDragStart={e => handleDragStart(e, task.id)}
            onDragOver={e => handleDragOver(e, task.id)}
            onDragEnd={handleDragEnd}
            onTouchStart={e => handleTouchStart(e, task.id)}
            onTouchMove={e => handleTouchMove(e)}
            onTouchEnd={handleTouchEnd}
          >
            <TaskPanel
              task={task}
              isActive={activeEntry?.taskId === task.id}
              index={idx}
              onEdit={setEditingTask}
              onStartTask={handleTaskClick}
              reorderMode={isReorderMode}
            />
          </div>
        ))}

        {!isReorderMode && (
          <button
            className="task-panel task-panel--add"
            onClick={() => {
              const customCount = state.tasks.filter(t => !t.isDefault).length;
              const unlimited = canUseFeature(entitlements.features, 'unlimited_panels');
              const maxPanels = getFeatureLimit(entitlements.features, 'max_custom_panels');
              if (!unlimited && customCount >= maxPanels) {
                setShowUpgrade(true);
              } else {
                setShowAdd(true);
              }
            }}
          >
            <span className="task-panel__add-icon">+</span>
            <span className="task-panel__name">Add Task</span>
          </button>
        )}
      </div>

      {/* Utility row: Break/Lunch buttons + Reorder */}
      <div className="task-utility-row">
        <div className="task-utility-row__breaks">
          {breakTasks.map(task => (
            <BreakButton
              key={task.id}
              task={task}
              isActive={activeEntry?.taskId === task.id}
              activeEntry={activeEntry?.taskId === task.id ? activeEntry : undefined}
              onClick={() => handleTaskClick(task.id)}
            />
          ))}
        </div>
        {!isReorderMode && (
          <button
            className="reorder-toggle-btn"
            onClick={() => setIsReorderMode(true)}
            title="Rearrange task tiles"
          >
            Reorder
          </button>
        )}
      </div>

      {promptTask && (
        <TaskNotePrompt
          task={promptTask}
          onConfirm={handleNoteConfirm}
          onSkip={handleNoteSkip}
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
    </>
  );
};

// ---- Compact break/lunch button ----

interface BreakButtonProps {
  task: Task;
  isActive: boolean;
  activeEntry?: { startTime: string };
  onClick: () => void;
}

const BreakButton: React.FC<BreakButtonProps> = ({ task, isActive, activeEntry, onClick }) => {
  const elapsed = useTimer(isActive && activeEntry ? activeEntry.startTime : null);
  const isLunch = task.name.toLowerCase() === 'lunch';
  const icon = isLunch ? '\uD83C\uDF7D\uFE0F' : '\u2615';
  const timerMs = task.timerMinutes * 60 * 1000;
  const remaining = timerMs > 0 && isActive ? Math.max(0, timerMs - elapsed) : 0;
  const isOvertime = timerMs > 0 && elapsed > timerMs;

  return (
    <button
      className={`break-btn ${isActive ? 'break-btn--active' : ''} ${isOvertime ? 'break-btn--overtime' : ''}`}
      onClick={onClick}
      title={`${task.name}${task.timerMinutes ? ` (${task.timerMinutes}m)` : ''}`}
    >
      <span className="break-btn__icon">{icon}</span>
      <span className="break-btn__label">{task.name}</span>
      {isActive && (
        <span className="break-btn__timer">
          {timerMs > 0 && !isOvertime
            ? formatDuration(remaining)
            : isOvertime
            ? `+${formatDuration(elapsed - timerMs)}`
            : formatDuration(elapsed)
          }
        </span>
      )}
      {!isActive && task.timerMinutes > 0 && (
        <span className="break-btn__duration">{task.timerMinutes}m</span>
      )}
    </button>
  );
};
