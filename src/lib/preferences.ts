// ============================================================
// App Preferences — "how the app works" settings
// ------------------------------------------------------------
// General-purpose user preferences that don't belong to a
// specific domain store (profile, projects, panels, breaks).
// Lives alongside lib/breakDefaults.ts which owns only the
// break/lunch countdown durations.
// ============================================================

/** Clock-time display: 12-hour (9:30 AM) vs 24-hour (09:30). */
export type TimeFormat = '12h' | '24h';

/** Which tab Home opens to by default. */
export type HomeTab = 'today' | 'week' | 'archive';

export interface AppPreferences {
  // ---- Display ----
  timeFormat: TimeFormat;
  defaultHomeTab: HomeTab;

  // ---- Notifications ----
  /** Master toggle — gates every notification feature. Without this,
   *  nothing fires even if the individual toggles below are on. */
  notificationsEnabled: boolean;
  /** Morning nudge: "Time to start tracking!" Only fires if no panel
   *  timer is currently running. */
  dailyReminderEnabled: boolean;
  /** "HH:MM" in 24-hour format, e.g. "09:00". */
  dailyReminderTime: string;
  /** Evening nudge: "Wrap up and generate your summary." */
  endOfDayEnabled: boolean;
  /** "HH:MM" in 24-hour format, e.g. "17:00". */
  endOfDayTime: string;
  /** Idle warning: fires when the same panel timer has been running
   *  for longer than this many minutes without a switch. */
  idleWarningEnabled: boolean;
  idleWarningMinutes: number;
}

const STORAGE_KEY = 'taskpanels.preferences.v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  timeFormat: '12h',
  defaultHomeTab: 'today',
  notificationsEnabled: false,
  dailyReminderEnabled: true,
  dailyReminderTime: '09:00',
  endOfDayEnabled: true,
  endOfDayTime: '17:00',
  idleWarningEnabled: true,
  idleWarningMinutes: 30,
};

const VALID_TIME_FORMATS: TimeFormat[] = ['12h', '24h'];
const VALID_HOME_TABS: HomeTab[] = ['today', 'week', 'archive'];

/** Minimal validation for "HH:MM" strings. */
const isValidTimeString = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      timeFormat:
        VALID_TIME_FORMATS.includes(parsed.timeFormat as TimeFormat)
          ? (parsed.timeFormat as TimeFormat)
          : DEFAULT_PREFERENCES.timeFormat,
      defaultHomeTab:
        VALID_HOME_TABS.includes(parsed.defaultHomeTab as HomeTab)
          ? (parsed.defaultHomeTab as HomeTab)
          : DEFAULT_PREFERENCES.defaultHomeTab,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === 'boolean'
          ? parsed.notificationsEnabled
          : DEFAULT_PREFERENCES.notificationsEnabled,
      dailyReminderEnabled:
        typeof parsed.dailyReminderEnabled === 'boolean'
          ? parsed.dailyReminderEnabled
          : DEFAULT_PREFERENCES.dailyReminderEnabled,
      dailyReminderTime:
        isValidTimeString(parsed.dailyReminderTime)
          ? parsed.dailyReminderTime
          : DEFAULT_PREFERENCES.dailyReminderTime,
      endOfDayEnabled:
        typeof parsed.endOfDayEnabled === 'boolean'
          ? parsed.endOfDayEnabled
          : DEFAULT_PREFERENCES.endOfDayEnabled,
      endOfDayTime:
        isValidTimeString(parsed.endOfDayTime)
          ? parsed.endOfDayTime
          : DEFAULT_PREFERENCES.endOfDayTime,
      idleWarningEnabled:
        typeof parsed.idleWarningEnabled === 'boolean'
          ? parsed.idleWarningEnabled
          : DEFAULT_PREFERENCES.idleWarningEnabled,
      idleWarningMinutes:
        typeof parsed.idleWarningMinutes === 'number' && parsed.idleWarningMinutes >= 1
          ? Math.min(480, Math.floor(parsed.idleWarningMinutes))
          : DEFAULT_PREFERENCES.idleWarningMinutes,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: AppPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota or privacy mode — ignore */
  }
}
