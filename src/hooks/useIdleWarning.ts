// ============================================================
// Idle warning hook — fires push notification when user has been
// on the same task for longer than settings.idleWarningMinutes
// ============================================================

import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { sendLocalNotification, getPushPermission } from '../utils/push';

export function useIdleWarning(): void {
  const { state, getActiveEntry } = useApp();
  const lastWarningRef = useRef<string | null>(null);

  useEffect(() => {
    if (getPushPermission() !== 'granted') return;
    if (!state.activeEntryId) {
      lastWarningRef.current = null;
      return;
    }

    const warningMs = state.settings.idleWarningMinutes * 60 * 1000;
    if (warningMs <= 0) return;

    const checkIdle = () => {
      const entry = getActiveEntry();
      if (!entry) return;

      const elapsed = Date.now() - new Date(entry.startTime).getTime();
      const warningKey = `${entry.id}-${Math.floor(elapsed / warningMs)}`;

      // Only warn once per warning interval per entry
      if (elapsed >= warningMs && lastWarningRef.current !== warningKey) {
        lastWarningRef.current = warningKey;
        const minutes = Math.round(elapsed / 60000);

        sendLocalNotification(
          `⏰ Still on "${entry.taskName}"`,
          `You've been on this task for ${minutes} minutes. Time to switch or add a note?`,
          'idle-warning'
        );
      }
    };

    // Check every minute
    const interval = setInterval(checkIdle, 60000);
    // Also check immediately
    checkIdle();

    return () => clearInterval(interval);
  }, [state.activeEntryId, state.settings.idleWarningMinutes, getActiveEntry]);
}
