// ============================================================
// Break / lunch default durations — persistence
// ------------------------------------------------------------
// Owns the user's preferred countdown length for the Break and
// Lunch buttons on Home. Kept in its own tiny module because it
// isn't tied to the panel catalog, the projects store, or the
// user profile — it's a pure UI preference that needs to be
// readable from TaskPanelsApp at mount time, before NavContext
// exists.
// ============================================================

import type { BreakKind } from './previewNav';
import { pushUserState } from './cloudState';

export type BreakDurationsMs = Record<BreakKind, number>;

const STORAGE_KEY = 'taskpanels.breakDefaults.v1';

/** Default countdowns — match the original hardcoded values so any
 *  existing install doesn't see a surprise change on first load. */
export const DEFAULT_BREAK_DURATIONS_MS: BreakDurationsMs = {
  break: 15 * 60 * 1000,
  lunch: 60 * 60 * 1000,
};

// Clamp guards:
//  - 1 minute minimum — zero-length countdowns have nothing to count
//  - 8 hours maximum  — anything larger is almost certainly a typo
const MIN_MS = 1 * 60 * 1000;
const MAX_MS = 8 * 60 * 60 * 1000;

/** Clamp to the safe range and round down to whole milliseconds. */
export const clampBreakMs = (ms: number): number =>
  Math.max(MIN_MS, Math.min(MAX_MS, Math.floor(ms)));

export function loadBreakDurations(): BreakDurationsMs {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_BREAK_DURATIONS_MS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BREAK_DURATIONS_MS };
    const parsed = JSON.parse(raw) as Partial<BreakDurationsMs>;
    return {
      break:
        typeof parsed.break === 'number'
          ? clampBreakMs(parsed.break)
          : DEFAULT_BREAK_DURATIONS_MS.break,
      lunch:
        typeof parsed.lunch === 'number'
          ? clampBreakMs(parsed.lunch)
          : DEFAULT_BREAK_DURATIONS_MS.lunch,
    };
  } catch {
    return { ...DEFAULT_BREAK_DURATIONS_MS };
  }
}

export function saveBreakDurations(durations: BreakDurationsMs): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const clamped: BreakDurationsMs = {
    break: clampBreakMs(durations.break),
    lunch: clampBreakMs(durations.lunch),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    /* quota or privacy mode — ignore */
  }
  pushUserState('break_defaults', clamped);
}
