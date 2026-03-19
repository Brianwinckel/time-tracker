// ============================================================
// Keyboard shortcuts for common actions
// ============================================================

import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function useKeyboardShortcuts() {
  const { state, dispatch } = useApp();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Escape — stop active task
      if (e.key === 'Escape' && state.activeEntryId) {
        e.preventDefault();
        dispatch({ type: 'STOP_TASK' });
        return;
      }

      // R — resume last task
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && state.lastTaskId && !state.activeEntryId) {
        e.preventDefault();
        dispatch({ type: 'RESUME_LAST_TASK' });
        return;
      }

      // 1-9 — quick-start task by position
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
        const index = parseInt(e.key) - 1;
        if (index < state.tasks.length) {
          e.preventDefault();
          dispatch({ type: 'START_TASK', taskId: state.tasks[index].id });
        }
        return;
      }

      // D — toggle dark mode
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        dispatch({ type: 'UPDATE_SETTINGS', settings: { darkMode: !state.settings.darkMode } });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.activeEntryId, state.lastTaskId, state.tasks, state.settings.darkMode, dispatch]);
}
