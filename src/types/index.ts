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
}

export interface TimeEntry {
  id: string;
  taskId: string;
  taskName: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // ISO timestamp
  endTime: string | null; // null = still running
  duration: number | null; // ms, null if still running
  note: string;
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
}

export interface AppState {
  tasks: Task[];
  entries: TimeEntry[];     // all entries for current date
  activeEntryId: string | null;
  lastTaskId: string | null; // for "resume last task"
  currentDate: string;       // YYYY-MM-DD
  dailyNote: string;
  settings: Settings;
  view: 'dashboard' | 'summary' | 'settings' | 'history';
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
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'NEW_DAY' }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }
  | { type: 'DUPLICATE_YESTERDAY' };
