// ============================================================
// Default tasks and settings for first launch
// ============================================================

import { v4 as uuid } from 'uuid';
import type { Task, Settings } from '../types';
import { TASK_COLORS } from './colors';

export const DEFAULT_TASKS: Task[] = [
  { id: uuid(), name: 'Email',    color: TASK_COLORS[0],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 0 },
  { id: uuid(), name: 'Meetings', color: TASK_COLORS[1],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 1 },
  { id: uuid(), name: 'Editing',  color: TASK_COLORS[2],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 2 },
  { id: uuid(), name: 'Writing',  color: TASK_COLORS[3],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 3 },
  { id: uuid(), name: 'Research', color: TASK_COLORS[4],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 4 },
  { id: uuid(), name: 'Admin',    color: TASK_COLORS[5],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 5 },
  { id: uuid(), name: 'Break',    color: TASK_COLORS[9],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 6 },
  { id: uuid(), name: 'Planning', color: TASK_COLORS[6],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 7 },
  { id: uuid(), name: 'Review',   color: TASK_COLORS[7],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 8 },
  { id: uuid(), name: 'Misc',     color: TASK_COLORS[8],  isDefault: true, isPinned: true, createdAt: new Date().toISOString(), order: 9 },
];

export const DEFAULT_SETTINGS: Settings = {
  bossName: 'Boss',
  myName: 'Your Name',
  emailSubjectFormat: 'Daily Work Summary - {date}',
  greeting: 'Hi {boss},\n\nHere is my work summary for today:',
  signoff: 'Thanks,\n{name}',
  timeFormat: '12h',
  darkMode: false,
  idleWarningMinutes: 15,
  autoEmailEnabled: false,
  autoEmailRecipient: '',
};
