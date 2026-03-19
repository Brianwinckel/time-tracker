// ============================================================
// Central app state — context + reducer + persistence
// ============================================================

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppState, AppAction, TimeEntry } from '../types';
import { DEFAULT_TASKS, DEFAULT_SETTINGS } from '../utils/defaults';
import { getToday, calcDuration } from '../utils/time';
import * as storage from '../storage/localStorage';

// ---- Initial state ----

function buildInitialState(): AppState {
  const today = getToday();
  const savedTasks = storage.loadTasks();
  const tasks = savedTasks.length > 0 ? savedTasks : DEFAULT_TASKS;

  // On first load, save default tasks
  if (savedTasks.length === 0) {
    storage.saveTasks(DEFAULT_TASKS);
  }

  const savedSettings = storage.loadSettings();
  const settings = savedSettings ?? DEFAULT_SETTINGS;
  if (!savedSettings) storage.saveSettings(DEFAULT_SETTINGS);

  const entries = storage.loadEntries(today);
  const activeEntryId = storage.loadActiveEntryId();
  const lastTaskId = storage.loadLastTaskId();
  const dailyNote = storage.loadDailyNote(today);

  return {
    tasks,
    entries,
    activeEntryId,
    lastTaskId,
    currentDate: today,
    dailyNote,
    settings,
    view: 'dashboard',
  };
}

// ---- Reducer ----

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_TASK': {
      const now = new Date().toISOString();
      const task = state.tasks.find(t => t.id === action.taskId);
      if (!task) return state;

      let entries = [...state.entries];
      let lastTaskId = state.lastTaskId;

      // If there's an active entry, close it
      if (state.activeEntryId) {
        const activeIdx = entries.findIndex(e => e.id === state.activeEntryId);
        if (activeIdx >= 0) {
          // If clicking the same active task, treat as "stop"
          if (entries[activeIdx].taskId === action.taskId) {
            entries[activeIdx] = {
              ...entries[activeIdx],
              endTime: now,
              duration: calcDuration(entries[activeIdx].startTime, now),
            };
            lastTaskId = entries[activeIdx].taskId;
            return { ...state, entries, activeEntryId: null, lastTaskId };
          }
          // Close previous entry
          entries[activeIdx] = {
            ...entries[activeIdx],
            endTime: now,
            duration: calcDuration(entries[activeIdx].startTime, now),
          };
          lastTaskId = entries[activeIdx].taskId;
        }
      }

      // Create new entry
      const newEntry: TimeEntry = {
        id: uuid(),
        taskId: action.taskId,
        taskName: task.name,
        date: state.currentDate,
        startTime: now,
        endTime: null,
        duration: null,
        note: action.note ?? '',
      };
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
      // Delegate to START_TASK
      return appReducer(state, { type: 'START_TASK', taskId: state.lastTaskId });
    }

    case 'ADD_TASK': {
      const tasks = [...state.tasks, action.task];
      return { ...state, tasks };
    }

    case 'UPDATE_TASK': {
      const tasks = state.tasks.map(t => t.id === action.task.id ? action.task : t);
      // Also update task name in today's entries
      const entries = state.entries.map(e =>
        e.taskId === action.task.id ? { ...e, taskName: action.task.name } : e
      );
      return { ...state, tasks, entries };
    }

    case 'DELETE_TASK': {
      const tasks = state.tasks.filter(t => t.id !== action.taskId);
      // Stop the task if it's active
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

    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings } };
    }

    case 'SET_VIEW': {
      return { ...state, view: action.view };
    }

    case 'NEW_DAY': {
      const today = getToday();
      if (today === state.currentDate) return state;

      // Stop any active task first
      let newState = state;
      if (state.activeEntryId) {
        newState = appReducer(state, { type: 'STOP_TASK' });
      }

      // Save current day's entries
      storage.saveEntries(newState.currentDate, newState.entries);
      storage.addTrackedDate(newState.currentDate);

      // Load new day
      const entries = storage.loadEntries(today);
      const dailyNote = storage.loadDailyNote(today);

      return {
        ...newState,
        currentDate: today,
        entries,
        dailyNote,
        activeEntryId: null,
      };
    }

    case 'LOAD_STATE': {
      return { ...state, ...action.state };
    }

    case 'DUPLICATE_YESTERDAY': {
      // This just ensures the same tasks are available — tasks are already global
      return state;
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
  const [state, dispatch] = useReducer(appReducer, undefined, buildInitialState);

  // Persist on every state change
  useEffect(() => {
    storage.saveTasks(state.tasks);
    storage.saveEntries(state.currentDate, state.entries);
    storage.saveSettings(state.settings);
    storage.saveActiveEntryId(state.activeEntryId);
    storage.saveLastTaskId(state.lastTaskId);
    storage.saveDailyNote(state.currentDate, state.dailyNote);
    storage.addTrackedDate(state.currentDate);
  }, [state]);

  // Check for day change every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getToday();
      if (today !== state.currentDate) {
        dispatch({ type: 'NEW_DAY' });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [state.currentDate]);

  // Warn before closing with active task
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.activeEntryId) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
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
