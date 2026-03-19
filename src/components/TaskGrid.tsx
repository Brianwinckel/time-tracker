// ============================================================
// Grid of task panels + "Add Task" button + note prompt
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskPanel } from './TaskPanel';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { TaskNotePrompt } from './TaskNotePrompt';
import type { Task } from '../types';

export const TaskGrid: React.FC = () => {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [promptTask, setPromptTask] = useState<Task | null>(null);

  const activeEntry = state.entries.find(e => e.id === state.activeEntryId);
  const sortedTasks = [...state.tasks].sort((a, b) => a.order - b.order);

  // When a task panel is clicked, show the note prompt
  const handleTaskClick = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // If clicking the active task, just stop it (no prompt needed)
    if (activeEntry?.taskId === taskId) {
      dispatch({ type: 'START_TASK', taskId }); // toggles stop
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
      <div className="task-grid">
        {sortedTasks.map((task, idx) => (
          <TaskPanel
            key={task.id}
            task={task}
            isActive={activeEntry?.taskId === task.id}
            index={idx}
            onEdit={setEditingTask}
            onStartTask={handleTaskClick}
          />
        ))}

        <button
          className="task-panel task-panel--add"
          onClick={() => setShowAdd(true)}
        >
          <span className="task-panel__add-icon">+</span>
          <span className="task-panel__name">Add Task</span>
        </button>
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
    </>
  );
};
