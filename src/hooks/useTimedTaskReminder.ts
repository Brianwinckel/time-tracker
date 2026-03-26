// ============================================================
// Timed task reminder hook — for Lunch/Break style tasks
// Sends a push notification when the timer expires
// ============================================================

import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { sendLocalNotification, getPushPermission } from '../utils/push';

export function useTimedTaskReminder(): void {
  const { state, getActiveEntry } = useApp();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.activeEntryId) {
      firedRef.current = null;
      return;
    }

    const entry = getActiveEntry();
    if (!entry) return;

    const task = state.tasks.find(t => t.id === entry.taskId);
    if (!task || !task.timerMinutes || task.timerMinutes <= 0) return;

    // Already fired for this entry
    if (firedRef.current === entry.id) return;

    const timerMs = task.timerMinutes * 60 * 1000;
    const elapsed = Date.now() - new Date(entry.startTime).getTime();
    const remaining = timerMs - elapsed;

    if (remaining <= 0) {
      // Already past timer — fire immediately
      if (firedRef.current !== entry.id) {
        firedRef.current = entry.id;
        fireReminder(task.name, task.timerMinutes);
      }
      return;
    }

    // Set timeout for when timer expires
    const timeout = setTimeout(() => {
      firedRef.current = entry.id;
      fireReminder(task.name, task.timerMinutes);
    }, remaining);

    return () => clearTimeout(timeout);
  }, [state.activeEntryId, state.tasks, getActiveEntry]);
}

function fireReminder(taskName: string, minutes: number): void {
  if (getPushPermission() !== 'granted') return;

  const isLunch = taskName.toLowerCase().includes('lunch');

  sendLocalNotification(
    isLunch ? '🍽️ Lunch is over!' : '☕ Break is over!',
    isLunch
      ? `Your ${minutes}-minute lunch break is up. Time to get back to work!`
      : `Your ${minutes}-minute break is done. Ready to switch tasks?`,
    'timed-task-reminder'
  );
}
