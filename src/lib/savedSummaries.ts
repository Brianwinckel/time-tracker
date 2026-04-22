// ============================================================
// savedSummaries — local persistence for archived daily reports
// ------------------------------------------------------------
// When the user generates a daily report from Prepare Summary,
// we stash the resulting SummaryInput (the normalized payload,
// not the rendered output) here so the Summary Archive can
// replay it on any future visit. Re-generating for the same
// date overwrites.
//
// Why save the *input* instead of the rendered DailySummaryData:
//   1. Inputs are ~10× smaller on disk (no derived KPIs /
//      legend / project breakdowns).
//   2. If the generator is later tuned (new copy, new buckets),
//      reloading from the saved input automatically benefits —
//      we don't ship stale-looking reports from last quarter.
//   3. The input already carries everything the user authored
//      (focus notes, outcomes, blockers, follow-ups) so the
//      "narrative layer" survives intact.
//
// Keyed by local-tz ISO date (YYYY-MM-DD) so a report you
// generated at 11pm Pacific lands on "today" in the calendar,
// not on tomorrow in UTC.
// ============================================================

import type { SummaryInput } from './summaryModel';
import { toIsoDate } from './dateUtils';
import { diffPushSavedSummaries } from './cloudRelational';

const STORAGE_KEY = 'tp.savedSummaries.v1';

export type SavedSummaryMap = Record<string, SummaryInput>;

/** Load the saved-summary map from localStorage, or an empty map
 *  if nothing is there / the blob is corrupt. Never throws — a
 *  bad payload just resets to empty so the app keeps booting. */
export function loadSavedSummaries(): SavedSummaryMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as SavedSummaryMap;
  } catch {
    return {};
  }
}

/** Persist the current map back to localStorage. Silent on quota
 *  errors — we'd rather drop a single save than crash the app. */
export function saveSavedSummaries(map: SavedSummaryMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded or disabled — swallow */
  }
  diffPushSavedSummaries(map);
}

/** Derive the YYYY-MM-DD key for a SummaryInput from the local
 *  date of its report-window start. The `dateRange.start` on
 *  disk is an ISO string (UTC); parsing it back and taking the
 *  *local* date matches the original local-midnight the Prepare
 *  screen passed in. */
export function keyForSummary(input: SummaryInput): string {
  return toIsoDate(new Date(input.dateRange.start));
}
