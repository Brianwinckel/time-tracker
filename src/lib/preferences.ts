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
  timeFormat: TimeFormat;
  defaultHomeTab: HomeTab;
}

const STORAGE_KEY = 'taskpanels.preferences.v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  timeFormat: '12h',
  defaultHomeTab: 'today',
};

const VALID_TIME_FORMATS: TimeFormat[] = ['12h', '24h'];
const VALID_HOME_TABS: HomeTab[] = ['today', 'week', 'archive'];

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
