// ============================================================
// Central app state — context + reducer + hybrid persistence
// Loads from Supabase on init, writes to both Supabase + localStorage
// ============================================================

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppState, AppAction, TimeEntry } from '../types';
import { DEFAULT_SETTINGS } from '../utils/defaults';
import { getToday, calcDuration } from '../utils/time';
import * as storage from '../storage';
import { flushPendingWrites } from '../storage';
import * as local from '../storage/localStorage';
import { useAuth } from './AuthContext';

// ---- Helper to create a new entry with all v2 defaults ----

function createEntry(fields: {
  taskId: string;
  taskName: string;
  date: string;
  note?: string;
}): TimeEntry {
  return {
    id: uuid(),
    taskId: fields.taskId,
    taskName: fields.taskName,
    date: fields.date,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    note: fields.note ?? '',
    projectId: null,
    valueCategory: null,
    workStyle: null,
    outputType: null,
    sessionStatus: 'In Progress',
    isCompleted: false,
    completionNote: '',
    nextSteps: '',
    blockedBy: '',
    carryForward: false,
  };
}

// ---- Default state (shown while loading) ----

function getDefaultState(): AppState {
  return {
    tasks: [],
    entries: [],
    tagOptions: [],
    activeEntryId: null,
    lastTaskId: null,
    currentDate: getToday(),
    dailyNote: '',
    settings: DEFAULT_SETTINGS,
    view: 'dashboard',
    loading: true,
  };
}

// ---- Reducer ----

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_TASK': {
      const task = state.tasks.find(t => t.id === action.taskId);
      if (!task) return state;

      let entries = [...state.entries];
      let lastTaskId = state.lastTaskId;
      const now = new Date().toISOString();

      if (state.activeEntryId) {
        const activeIdx = entries.findIndex(e => e.id === state.activeEntryId);
        if (activeIdx >= 0) {
          if (entries[activeIdx].taskId === action.taskId) {
            // Clicking same task = toggle off
            entries[activeIdx] = {
              ...entries[activeIdx],
              endTime: now,
              duration: calcDuration(entries[activeIdx].startTime, now),
            };
            lastTaskId = entries[activeIdx].taskId;
            return { ...state, entries, activeEntryId: null, lastTaskId };
          }
          // Stop current task
          entries[activeIdx] = {
            ...entries[activeIdx],
            endTime: now,
            duration: calcDuration(entries[activeIdx].startTime, now),
          };
          lastTaskId = entries[activeIdx].taskId;
        }
      }

      const newEntry = createEntry({
        taskId: action.taskId,
        taskName: task.name,
        date: state.currentDate,
        note: action.note,
      });
      // Override startTime to use the `now` we already computed
      newEntry.startTime = now;
      entries.push(newEntry);

      return { ...state, entries, activeEntryId: newEntry.id, lastTaskId };
    }

    case 'STOP_TASK': {
      if (!state.activeEntryId) return state;
      const now = new Date().toISOString();
      const entries = state.entries.map(e =>
        e.id === state.activeEntryId
          ? { ...e, endTime: now, duration: calcDuration(e.startTime, now) }
          : e
      );
      const activeEntry = state.entries.find(e => e.id === state.activeEntryId);
      return {
        ...state,
        entries,
        activeEntryId: null,
        lastTaskId: activeEntry?.taskId ?? state.lastTaskId,
      };
    }

    case 'RESUME_LAST_TASK': {
      if (!state.lastTaskId) return state;
      return appReducer(state, { type: 'START_TASK', taskId: state.lastTaskId });
    }

    case 'ADD_TASK': {
      return { ...state, tasks: [...state.tasks, action.task] };
    }

    case 'UPDATE_TASK': {
      const tasks = state.tasks.map(t => t.id === action.task.id ? action.task : t);
      const entries = state.entries.map(e =>
        e.taskId === action.task.id ? { ...e, taskName: action.task.name } : e
      );
      return { ...state, tasks, entries };
    }

    case 'DELETE_TASK': {
      const tasks = state.tasks.filter(t => t.id !== action.taskId);
      let newState = state;
      const activeEntry = state.entries.find(e => e.id === state.activeEntryId);
      if (activeEntry?.taskId === action.taskId) {
        newState = appReducer(state, { type: 'STOP_TASK' });
      }
      return { ...newState, tasks };
    }

    case 'UPDATE_ENTRY': {
      const entries = state.entries.map(e =>
        e.id === action.entry.id ? action.entry : e
      );
      return { ...state, entries };
    }

    case 'DELETE_ENTRY': {
      const entries = state.entries.filter(e => e.id !== action.entryId);
      const activeEntryId = state.activeEntryId === action.entryId ? null : state.activeEntryId;
      return { ...state, entries, activeEntryId };
    }

    case 'ADD_MANUAL_ENTRY': {
      return { ...state, entries: [...state.entries, action.entry] };
    }

    case 'SET_DAILY_NOTE': {
      return { ...state, dailyNote: action.note };
    }

    case 'SET_ENTRY_NOTE': {
      const entries = state.entries.map(e =>
        e.id === action.entryId ? { ...e, note: action.note } : e
      );
      return { ...state, entries };
    }

    case 'SET_ENTRY_TAGS': {
      const entries = state.entries.map(e =>
        e.id === action.entryId ? { ...e, ...action.tags } : e
      );
      return { ...state, entries };
    }

    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings } };
    }

    case 'SET_VIEW': {
      return { ...state, view: action.view };
    }

    case 'NEW_DAY': {
      const today = getToday();
      if (today === state.currentDate) return state;
      let newState = state;
      if (state.activeEntryId) {
        newState = appReducer(state, { type: 'STOP_TASK' });
      }
      return {
        ...newState,
        currentDate: today,
        entries: [],
        dailyNote: '',
        activeEntryId: null,
        loading: true,
      };
    }

    case 'LOAD_STATE': {
      return { ...state, ...action.state };
    }

    case 'REORDER_TASKS': {
      const tasks = action.taskIds.map((id, idx) => {
        const task = state.tasks.find(t => t.id === id)!;
        return { ...task, order: idx };
      });
      return { ...state, tasks };
    }

    case 'DUPLICATE_YESTERDAY': {
      return state;
    }

    // ---- Tag Options ----

    case 'LOAD_TAG_OPTIONS': {
      return { ...state, tagOptions: action.options };
    }

    case 'ADD_TAG_OPTION': {
      return { ...state, tagOptions: [...state.tagOptions, action.option] };
    }

    case 'UPDATE_TAG_OPTION': {
      const tagOptions = state.tagOptions.map(o =>
        o.id === action.option.id ? action.option : o
      );
      return { ...state, tagOptions };
    }

    case 'DELETE_TAG_OPTION': {
      const tagOptions = state.tagOptions.filter(o => o.id !== action.optionId);
      return { ...state, tagOptions };
    }

    default:
      return state;
  }
}

// ---- Context ----

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  getActiveEntry: () => TimeEntry | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [state, dispatch] = useReducer(appReducer, undefined, getDefaultState);
  const prevStateRef = useRef<AppState | null>(null);
  const initializedRef = useRef(false);

  // ---- Async initialization: load from Supabase ----
  useEffect(() => {
    if (!userId || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const today = getToday();

      const [tasks, entries, settings, dailyNote, activeEntryId, tagOptions] = await Promise.all([
        storage.loadTasks(userId),
        storage.loadEntries(userId, today),
        storage.loadSettings(userId),
        storage.loadDailyNote(userId, today),
        storage.loadActiveEntryId(userId, today),
        storage.loadTagOptions(userId),
      ]);

      const lastTaskId = local.loadLastTaskId();

      dispatch({
        type: 'LOAD_STATE',
        state: {
          tasks,
          entries,
          tagOptions,
          settings: settings ?? DEFAULT_SETTINGS,
          dailyNote,
          activeEntryId,
          lastTaskId,
          currentDate: today,
          loading: false,
        },
      });
    };

    init();
  }, [userId]);

  // ---- Persist changes to hybrid storage ----
  useEffect(() => {
    if (!userId || state.loading) return;

    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (!prev || prev.loading) return;

    if (prev.tasks !== state.tasks) {
      storage.saveTasks(userId, state.tasks);
      const removedIds = prev.tasks
        .filter(t => !state.tasks.find(s => s.id === t.id))
        .map(t => t.id);
      removedIds.forEach(id => storage.deleteTask(userId, id));
    }

    if (prev.entries !== state.entries) {
      storage.saveEntries(userId, state.currentDate, state.entries);
      const removedIds = prev.entries
        .filter(e => !state.entries.find(s => s.id === e.id))
        .map(e => e.id);
      removedIds.forEach(id => storage.deleteEntry(id));
    }

    if (prev.settings !== state.settings) {
      storage.saveSettings(userId, state.settings);
    }

    if (prev.dailyNote !== state.dailyNote) {
      storage.saveDailyNote(userId, state.currentDate, state.dailyNote);
    }

    if (prev.activeEntryId !== state.activeEntryId) {
      storage.saveActiveEntryId(state.activeEntryId);
    }

    if (prev.lastTaskId !== state.lastTaskId) {
      storage.saveLastTaskId(state.lastTaskId);
    }

    // Tag option persistence is handled individually via dispatch side-effects
    // (ADD/UPDATE/DELETE actions call storage directly in components)

    storage.addTrackedDate(state.currentDate);
  }, [state, userId]);

  // ---- Load new day's data when day changes ----
  useEffect(() => {
    if (!userId || !state.loading) return;
    const loadNewDay = async () => {
      const [entries, dailyNote, activeEntryId] = await Promise.all([
        storage.loadEntries(userId, state.currentDate),
        storage.loadDailyNote(userId, state.currentDate),
        storage.loadActiveEntryId(userId, state.currentDate),
      ]);
      dispatch({
        type: 'LOAD_STATE',
        state: { entries, dailyNote, activeEntryId, loading: false },
      });
    };
    loadNewDay();
  }, [state.currentDate, state.loading, userId]);

  // ---- Check for day change every minute ----
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getToday();
      if (today !== state.currentDate) {
        dispatch({ type: 'NEW_DAY' });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [state.currentDate]);

  // ---- Flush writes on page hide / app background (critical on mobile) ----
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      flushPendingWrites();
      if (state.activeEntryId) e.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background (mobile tab switch, home screen, etc.)
        flushPendingWrites();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.activeEntryId]);

  const getActiveEntry = useCallback(() => {
    return state.entries.find(e => e.id === state.activeEntryId);
  }, [state.entries, state.activeEntryId]);

  return (
    <AppContext.Provider value={{ state, dispatch, getActiveEntry }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
