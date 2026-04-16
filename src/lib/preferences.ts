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
export type HomeTab = 'today' | 'archive';

/** Default audience for summary generation. */
export type DefaultAudience = 'manager' | 'team' | 'client' | 'personal';

/** Default summary style (level of detail). */
export type DefaultSummaryStyle = 'concise' | 'standard' | 'detailed';

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

  // ---- Reporting: Summary Defaults ----
  /** Default audience for Prepare Summary. */
  defaultAudience: DefaultAudience;
  /** Default detail level for Prepare Summary. */
  defaultSummaryStyle: DefaultSummaryStyle;
  /** Overtime threshold in hours. Time beyond this is flagged.
   *  Clamped to [1, 16]. Default 8. */
  overtimeThresholdHours: number;

  // ---- Reporting: Summary Content Blocks ----
  /** Toggle visibility of individual blocks on the generated summary. */
  summaryShowScorecard: boolean;
  summaryShowDayComposition: boolean;
  summaryShowTimeline: boolean;
  summaryShowProjectBreakdown: boolean;
  summaryShowNarrative: boolean;
  summaryShowFollowUps: boolean;
  summaryShowOvertime: boolean;

  // ---- Reporting: Email Template ----
  /** Subject line template. {date} is replaced with the report date. */
  emailSubjectTemplate: string;
  /** Include the timeline block in exported/emailed summaries. */
  emailIncludeTimeline: boolean;
  /** Include the narrative block in exported/emailed summaries. */
  emailIncludeNarrative: boolean;
  /** Include the project breakdown block. */
  emailIncludeProjects: boolean;

  // ---- Reporting: Auto Daily Email ----
  /** Master toggle for auto daily email delivery. */
  autoDailyEmailEnabled: boolean;
  /** "HH:MM" in 24-hour format for when the email fires. */
  autoDailyEmailTime: string;
  /** Recipient address for the auto email. */
  autoDailyEmailRecipient: string;
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
  // Reporting: Summary Defaults
  defaultAudience: 'manager',
  defaultSummaryStyle: 'standard',
  overtimeThresholdHours: 8,
  // Reporting: Summary Content Blocks
  summaryShowScorecard: true,
  summaryShowDayComposition: true,
  summaryShowTimeline: true,
  summaryShowProjectBreakdown: true,
  summaryShowNarrative: true,
  summaryShowFollowUps: true,
  summaryShowOvertime: true,
  // Reporting: Email Template
  emailSubjectTemplate: 'Daily Summary — {date}',
  emailIncludeTimeline: true,
  emailIncludeNarrative: true,
  emailIncludeProjects: true,
  // Reporting: Auto Daily Email
  autoDailyEmailEnabled: false,
  autoDailyEmailTime: '17:30',
  autoDailyEmailRecipient: '',
};

const VALID_TIME_FORMATS: TimeFormat[] = ['12h', '24h'];
const VALID_HOME_TABS: HomeTab[] = ['today', 'archive'];
const VALID_AUDIENCES: DefaultAudience[] = ['manager', 'team', 'client', 'personal'];
const VALID_SUMMARY_STYLES: DefaultSummaryStyle[] = ['concise', 'standard', 'detailed'];

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
      // Reporting: Summary Defaults
      defaultAudience:
        VALID_AUDIENCES.includes(parsed.defaultAudience as DefaultAudience)
          ? (parsed.defaultAudience as DefaultAudience)
          : DEFAULT_PREFERENCES.defaultAudience,
      defaultSummaryStyle:
        VALID_SUMMARY_STYLES.includes(parsed.defaultSummaryStyle as DefaultSummaryStyle)
          ? (parsed.defaultSummaryStyle as DefaultSummaryStyle)
          : DEFAULT_PREFERENCES.defaultSummaryStyle,
      overtimeThresholdHours:
        typeof parsed.overtimeThresholdHours === 'number' && parsed.overtimeThresholdHours >= 1
          ? Math.min(16, Math.floor(parsed.overtimeThresholdHours))
          : DEFAULT_PREFERENCES.overtimeThresholdHours,
      summaryShowScorecard:
        typeof parsed.summaryShowScorecard === 'boolean'
          ? parsed.summaryShowScorecard
          : DEFAULT_PREFERENCES.summaryShowScorecard,
      summaryShowDayComposition:
        typeof parsed.summaryShowDayComposition === 'boolean'
          ? parsed.summaryShowDayComposition
          : DEFAULT_PREFERENCES.summaryShowDayComposition,
      summaryShowTimeline:
        typeof parsed.summaryShowTimeline === 'boolean'
          ? parsed.summaryShowTimeline
          : DEFAULT_PREFERENCES.summaryShowTimeline,
      summaryShowProjectBreakdown:
        typeof parsed.summaryShowProjectBreakdown === 'boolean'
          ? parsed.summaryShowProjectBreakdown
          : DEFAULT_PREFERENCES.summaryShowProjectBreakdown,
      summaryShowNarrative:
        typeof parsed.summaryShowNarrative === 'boolean'
          ? parsed.summaryShowNarrative
          : DEFAULT_PREFERENCES.summaryShowNarrative,
      summaryShowFollowUps:
        typeof parsed.summaryShowFollowUps === 'boolean'
          ? parsed.summaryShowFollowUps
          : DEFAULT_PREFERENCES.summaryShowFollowUps,
      summaryShowOvertime:
        typeof parsed.summaryShowOvertime === 'boolean'
          ? parsed.summaryShowOvertime
          : DEFAULT_PREFERENCES.summaryShowOvertime,
      // Reporting: Email Template
      emailSubjectTemplate:
        typeof parsed.emailSubjectTemplate === 'string' && parsed.emailSubjectTemplate.trim().length > 0
          ? parsed.emailSubjectTemplate
          : DEFAULT_PREFERENCES.emailSubjectTemplate,
      emailIncludeTimeline:
        typeof parsed.emailIncludeTimeline === 'boolean'
          ? parsed.emailIncludeTimeline
          : DEFAULT_PREFERENCES.emailIncludeTimeline,
      emailIncludeNarrative:
        typeof parsed.emailIncludeNarrative === 'boolean'
          ? parsed.emailIncludeNarrative
          : DEFAULT_PREFERENCES.emailIncludeNarrative,
      emailIncludeProjects:
        typeof parsed.emailIncludeProjects === 'boolean'
          ? parsed.emailIncludeProjects
          : DEFAULT_PREFERENCES.emailIncludeProjects,
      // Reporting: Auto Daily Email
      autoDailyEmailEnabled:
        typeof parsed.autoDailyEmailEnabled === 'boolean'
          ? parsed.autoDailyEmailEnabled
          : DEFAULT_PREFERENCES.autoDailyEmailEnabled,
      autoDailyEmailTime:
        isValidTimeString(parsed.autoDailyEmailTime)
          ? parsed.autoDailyEmailTime
          : DEFAULT_PREFERENCES.autoDailyEmailTime,
      autoDailyEmailRecipient:
        typeof parsed.autoDailyEmailRecipient === 'string'
          ? parsed.autoDailyEmailRecipient.trim()
          : DEFAULT_PREFERENCES.autoDailyEmailRecipient,
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
