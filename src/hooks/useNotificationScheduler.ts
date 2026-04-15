// ============================================================
// Notification Scheduler — V6 time-based and idle reminders
// ------------------------------------------------------------
// Mounted once in TaskPanelsApp. Runs a check every 60 seconds
// and fires local notifications via the service worker when:
//
//  1. Daily Reminder — morning nudge if no panel timer is running.
//  2. End-of-Day Prompt — evening nudge to generate a summary.
//  3. Idle Warning — fires when the same panel has been timing
//     continuously for longer than the configured threshold.
//
// Each time-based notification fires at most once per calendar
// day, tracked via localStorage so a force-close + reopen
// doesn't re-fire the same notification.
// ============================================================

import { useEffect, useRef } from 'react';
import type { AppPreferences } from '../lib/preferences';
import type { ActiveTimer } from '../lib/previewNav';
import { sendLocalNotification, isPushSupported } from '../utils/push';

// ---- "Already fired today" persistence ----

const FIRED_KEY = 'taskpanels.notifFired.v1';

interface FiredState {
  dailyReminder?: string;  // ISO date "YYYY-MM-DD"
  endOfDay?: string;
}

function loadFired(): FiredState {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markFired(key: keyof FiredState, isoDate: string) {
  try {
    const prev = loadFired();
    prev[key] = isoDate;
    localStorage.setItem(FIRED_KEY, JSON.stringify(prev));
  } catch { /* ignore */ }
}

// ---- Helpers ----

/** "YYYY-MM-DD" in local time. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "HH:MM" in local time. */
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---- Hook ----

export function useNotificationScheduler(
  preferences: AppPreferences,
  activeTimer: ActiveTimer,
) {
  // Track which idle-warning "interval" we last fired for, so we
  // only warn once per threshold-crossing (not every 60s while idle).
  const lastIdleWarningRef = useRef<string | null>(null);

  useEffect(() => {
    // Gate: notifications must be globally enabled AND the browser
    // must support the Notification API.
    if (!preferences.notificationsEnabled) return;
    if (!isPushSupported()) return;
    if (Notification.permission !== 'granted') return;

    const check = () => {
      const today = todayIso();
      const now = nowHHMM();
      const fired = loadFired();

      // ---- 1. Daily Reminder ----
      if (
        preferences.dailyReminderEnabled &&
        now === preferences.dailyReminderTime &&
        fired.dailyReminder !== today &&
        !activeTimer               // only nudge if nothing is running
      ) {
        sendLocalNotification(
          '☀️ Good morning!',
          'Time to start tracking your day. Open TaskPanels and tap a panel to begin.',
          'daily-reminder',
        );
        markFired('dailyReminder', today);
      }

      // ---- 2. End-of-Day Prompt ----
      if (
        preferences.endOfDayEnabled &&
        now === preferences.endOfDayTime &&
        fired.endOfDay !== today
      ) {
        sendLocalNotification(
          '🌙 Time to wrap up',
          'Generate your daily summary before heading out — your tracked time is ready to go.',
          'end-of-day',
        );
        markFired('endOfDay', today);
      }

      // ---- 3. Idle Warning ----
      if (preferences.idleWarningEnabled && activeTimer) {
        const elapsedMs = Date.now() - activeTimer.startedAt;
        const thresholdMs = preferences.idleWarningMinutes * 60 * 1000;
        if (thresholdMs > 0 && elapsedMs >= thresholdMs) {
          // Create a unique key per threshold crossing so we only
          // warn once per interval (e.g. once at 30m, once at 60m).
          const interval = Math.floor(elapsedMs / thresholdMs);
          const warningKey = `${activeTimer.panelId}-${interval}`;
          if (lastIdleWarningRef.current !== warningKey) {
            lastIdleWarningRef.current = warningKey;
            const minutes = Math.round(elapsedMs / 60000);
            sendLocalNotification(
              `⏰ Still on the same panel`,
              `You've been timing this panel for ${minutes} minutes. Time to switch or take a break?`,
              'idle-warning',
            );
          }
        }
      }
    };

    // Check immediately on mount / dependency change, then every 60s.
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [
    preferences.notificationsEnabled,
    preferences.dailyReminderEnabled,
    preferences.dailyReminderTime,
    preferences.endOfDayEnabled,
    preferences.endOfDayTime,
    preferences.idleWarningEnabled,
    preferences.idleWarningMinutes,
    activeTimer,
  ]);

  // Reset the idle warning ref when the active timer changes (user
  // switched panels), so the next panel gets a fresh warning cycle.
  useEffect(() => {
    lastIdleWarningRef.current = null;
  }, [activeTimer?.panelId]);
}
