// ============================================================
// Core data types for the Time Tracker app
// ============================================================

export interface Task {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;   // true = ships with app, false = user-created
  isPinned: boolean;     // pinned tasks persist permanently
  createdAt: string;     // ISO timestamp
  order: number;         // display order
  timerMinutes: number;  // 0 = no timer, >0 = auto-remind after N minutes
}

// ---- Tagging / Value Tracking ----

export type SessionStatus = 'In Progress' | 'Completed' | 'Needs Follow-up' | 'Needs Pass-off' | 'Blocked' | 'Shelved' | 'Scrapped';

export type TagCategory = 'project' | 'value_category' | 'work_style' | 'output_type' | 'session_status';

export interface TagOption {
  id: string;
  userId: string;
  category: TagCategory;
  value: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
}

// ---- Time Entries (extended with tagging) ----

export interface TimeEntry {
  id: string;
  taskId: string;
  taskName: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // ISO timestamp
  endTime: string | null; // null = still running
  duration: number | null; // ms, null if still running
  note: string;

  // v2 tagging fields (all optional for backwards compat)
  projectId: string | null;
  valueCategory: string | null;
  workStyle: string | null;
  outputType: string | null;
  sessionStatus: SessionStatus | string; // default: 'In Progress', string for custom statuses
  isCompleted: boolean;
  completionNote: string;
  nextSteps: string;
  blockedBy: string;
  carryForward: boolean;
}

/** Data collected from the SessionOutcomeModal */
export interface SessionOutcome {
  isCompleted: boolean;
  sessionStatus: string;
  outputType: string | null;
  completionNote: string;
  nextSteps: string;
  blockedBy: string;
  carryForward: boolean;
}

export interface DailySummary {
  date: string;          // YYYY-MM-DD
  entries: TimeEntry[];
  dailyNote: string;
  totalTrackedMs: number;
  taskTotals: Record<string, number>; // taskId -> total ms
}

export interface Settings {
  bossName: string;
  myName: string;
  emailSubjectFormat: string;  // e.g. "Daily Work Summary - {date}"
  greeting: string;
  signoff: string;
  timeFormat: '12h' | '24h';
  darkMode: boolean;
  idleWarningMinutes: number;
  autoEmailEnabled: boolean;
  autoEmailRecipient: string;
  autoEmailTime: string;         // HH:MM in 24h format, e.g. "17:00"
  autoEmailMinHours: number;     // minimum tracked hours to allow auto-send (e.g. 8)
  autoEmailMaxGapMin: number;    // max untracked gap in minutes before blocking (e.g. 120)
}

export interface AppState {
  tasks: Task[];
  entries: TimeEntry[];     // all entries for current date
  tagOptions: TagOption[];  // user's customizable tag options
  activeEntryId: string | null;
  lastTaskId: string | null; // for "resume last task"
  currentDate: string;       // YYYY-MM-DD
  dailyNote: string;
  settings: Settings;
  view: 'dashboard' | 'summary' | 'prepare-summary' | 'review' | 'settings' | 'history' | 'manager' | 'admin';
  loading: boolean;        // true while initial data is loading from Supabase
}

// Actions for the reducer
export type AppAction =
  | { type: 'START_TASK'; taskId: string; note?: string }
  | { type: 'STOP_TASK' }
  | { type: 'RESUME_LAST_TASK' }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'UPDATE_ENTRY'; entry: TimeEntry }
  | { type: 'DELETE_ENTRY'; entryId: string }
  | { type: 'ADD_MANUAL_ENTRY'; entry: TimeEntry }
  | { type: 'SET_DAILY_NOTE'; note: string }
  | { type: 'SET_ENTRY_NOTE'; entryId: string; note: string }
  | { type: 'SET_ENTRY_TAGS'; entryId: string; tags: Partial<TimeEntry> }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'NEW_DAY' }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }
  | { type: 'DUPLICATE_YESTERDAY' }
  | { type: 'REORDER_TASKS'; taskIds: string[] }
  | { type: 'LOAD_TAG_OPTIONS'; options: TagOption[] }
  | { type: 'ADD_TAG_OPTION'; option: TagOption }
  | { type: 'UPDATE_TAG_OPTION'; option: TagOption }
  | { type: 'DELETE_TAG_OPTION'; optionId: string };

// ---- Billing Types ----

export type PlanId = 'free' | 'pro' | 'team';
export type BillingInterval = 'month' | 'year';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';

export type FeatureKey =
  | 'unlimited_panels' | 'max_custom_panels' | 'history_days'
  | 'daily_summary_basic' | 'daily_summary_full'
  | 'blocker_tracking' | 'passoff_tracking' | 'unrealized_effort'
  | 'weekly_reports' | 'exports' | 'email_tools'
  | 'manager_dashboard' | 'team_visibility' | 'shared_rollups' | 'admin_controls';

export interface Subscription {
  id: string;
  billing_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  quantity: number;
}

export interface Entitlement {
  id: string;
  user_id: string;
  plan: PlanId;
  source: 'default' | 'subscription' | 'team_membership' | 'override';
  features: Record<string, boolean | number>;
  subscription_id: string | null;
  valid_until: string | null;
}

export interface ResolvedEntitlements {
  plan: PlanId;
  features: Record<FeatureKey, boolean | number>;
  source: string;
  subscription?: Subscription;
  trialEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
}
