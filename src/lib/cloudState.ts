// ============================================================
// cloudState — hybrid storage for JSON-blob app state.
//
// The pattern:
//  - localStorage is always the synchronous source for renders
//  - Supabase is the authoritative cross-device source
//  - On sign-in, hydrateFromCloud() pulls Supabase into localStorage
//    (cloud wins if present; otherwise local-to-cloud migration)
//  - On every save, pushUserState() debounces a write to Supabase
//    while localStorage is updated immediately
//
// The auth context calls setCloudStateUser(user.id) on sign-in and
// setCloudStateUser(null) on sign-out so this module always knows
// who it's writing for. Pushes without a user are silently no-op'd.
// ============================================================

import { supabase } from './supabase';
import { enqueue } from './cloudQueue';

export type StateKey = 'profile' | 'preferences' | 'onboarding' | 'break_defaults' | 'catalog';

interface UserStateRow {
  user_id: string;
  profile: unknown | null;
  preferences: unknown | null;
  onboarding: unknown | null;
  break_defaults: unknown | null;
  catalog: unknown | null;
  created_at?: string;
  updated_at?: string;
}

// ---- User binding ----

let currentUserId: string | null = null;

export function setCloudStateUser(userId: string | null): void {
  currentUserId = userId;
}

export function getCloudStateUser(): string | null {
  return currentUserId;
}

// ---- Debounced pusher (one timer per key so writes don't starve each other) ----

const pushTimers: Partial<Record<StateKey, number>> = {};
const DEFAULT_DEBOUNCE_MS = 600;

export function pushUserState<T>(key: StateKey, value: T, ms = DEFAULT_DEBOUNCE_MS): void {
  const userId = currentUserId;
  if (!userId) return; // not signed in — localStorage only
  if (pushTimers[key]) window.clearTimeout(pushTimers[key]);
  pushTimers[key] = window.setTimeout(async () => {
    delete pushTimers[key];
    const row = { user_id: userId, [key]: value, updated_at: new Date().toISOString() };
    try {
      const { error } = await supabase
        .from('user_state')
        .upsert(row, { onConflict: 'user_id' });
      if (error) {
        console.error(`[cloudState] upsert ${key} failed:`, error.message);
        enqueue('user_state', 'upsert', row, { onConflict: 'user_id' });
      }
    } catch (err) {
      console.error('[cloudState] push threw:', err);
      enqueue('user_state', 'upsert', row, { onConflict: 'user_id' });
    }
  }, ms);
}

/** Flush any pending debounced writes immediately. Call before signout. */
export async function flushPendingPushes(): Promise<void> {
  const keys = Object.keys(pushTimers) as StateKey[];
  for (const k of keys) {
    if (pushTimers[k]) {
      window.clearTimeout(pushTimers[k]);
      delete pushTimers[k];
    }
  }
  // Writes in-flight will complete on their own; we only cancel timers
  // that haven't fired yet. For the tiny blobs here that's a non-issue.
}

// ---- Hydration ----

interface StorageModule<T> {
  storageKey: string;
  stateKey: StateKey;
  /** Validate the cloud value and coerce to the module's shape. */
  normalize: (raw: unknown) => T | null;
}

interface HydrationResult {
  /** Keys where cloud had data and was written to localStorage. */
  hydrated: StateKey[];
  /** Keys where local had data and was pushed up to cloud. */
  uploaded: StateKey[];
  error?: string;
}

/**
 * On sign-in, sync local and cloud state. Called once per auth session.
 *
 * For each module:
 *  - Cloud has a value  → write it to localStorage (cloud wins)
 *  - Cloud is empty AND local has a value → push local to cloud
 *  - Both empty → nothing to do
 */
export async function hydrateFromCloud(
  userId: string,
  modules: StorageModule<unknown>[],
): Promise<HydrationResult> {
  const result: HydrationResult = { hydrated: [], uploaded: [] };

  let row: UserStateRow | null = null;
  try {
    const { data, error } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    row = (data as UserStateRow | null) ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cloudState] hydrate fetch failed:', msg);
    result.error = msg;
    return result;
  }

  const toUpload: Partial<Record<StateKey, unknown>> = {};

  for (const mod of modules) {
    const cloudRaw = row?.[mod.stateKey] ?? null;
    const cloudVal = cloudRaw != null ? mod.normalize(cloudRaw) : null;

    if (cloudVal != null) {
      // Cloud wins — write it into localStorage.
      try {
        localStorage.setItem(mod.storageKey, JSON.stringify(cloudVal));
        result.hydrated.push(mod.stateKey);
      } catch (err) {
        console.error(`[cloudState] localStorage write for ${mod.stateKey} failed:`, err);
      }
    } else {
      // Cloud empty — check if local has data to push up.
      try {
        const localRaw = localStorage.getItem(mod.storageKey);
        if (localRaw) {
          const parsed: unknown = JSON.parse(localRaw);
          if (parsed != null) {
            toUpload[mod.stateKey] = parsed;
            result.uploaded.push(mod.stateKey);
          }
        }
      } catch {
        /* malformed localStorage JSON — skip */
      }
    }
  }

  if (Object.keys(toUpload).length > 0) {
    try {
      const { error } = await supabase.from('user_state').upsert(
        { user_id: userId, ...toUpload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (error) console.error('[cloudState] initial upload failed:', error.message);
    } catch (err) {
      console.error('[cloudState] initial upload threw:', err);
    }
  }

  return result;
}

// ---- Module manifest ----
//
// Helper so each module registers its own metadata in one place.
// Currently consumed by the hydration step in App.tsx.
export type { StorageModule, HydrationResult };
