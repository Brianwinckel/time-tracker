// ============================================================
// cloudQueue — persistent retry queue for failed Supabase writes.
//
// Without this, a transient network failure means the push is lost
// from the cloud's perspective while still live in localStorage.
// On the next sign-in, hydrate sees cloud has data and overwrites
// local — quietly losing the unsynced change.
//
// The pattern:
//  - cloudState.pushUserState and cloudRelational.flush wrap their
//    Supabase calls and enqueue() on failure
//  - drain() is called from:
//      1. window focus (cheapest win — user tabs back, retry fires)
//      2. `online` event (covers going from offline → online)
//      3. a periodic timer (every 60s, catches server-side flakes
//         that don't trip the online event)
//  - Each entry has an attempt counter; after MAX_ATTEMPTS the entry
//    is dropped and an error is logged. The queue is capped at
//    MAX_QUEUE_SIZE overall (FIFO drop on overflow) so a week of
//    offline use doesn't bloat localStorage.
//
// Everything runs browser-side. No server endpoint needed.
// ============================================================

import { supabase } from './supabase';
import { getCloudStateUser } from './cloudState';

const STORAGE_KEY = 'taskpanels.cloudQueue.v1';
const MAX_ATTEMPTS = 8;
const MAX_QUEUE_SIZE = 500;
const DRAIN_INTERVAL_MS = 60_000;

export type QueueOp = 'upsert' | 'delete';

export interface QueueEntry {
  id: string;
  userId: string;                 // captured at enqueue time
  table: string;
  op: QueueOp;
  payload: unknown;               // for upsert: row(s); for delete: string[] of ids
  opts: {
    onConflict?: string;
    filterColumn?: string;        // for delete
    scopeToUser?: boolean;        // for delete on composite-PK tables
  };
  attempts: number;
  enqueuedAt: number;
}

// ---- Persistence ----

function readQueue(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueueEntry[]): void {
  try {
    // Cap to avoid unbounded localStorage growth. FIFO — keep most
    // recent entries since they're most likely to still be useful.
    const trimmed = q.length > MAX_QUEUE_SIZE ? q.slice(-MAX_QUEUE_SIZE) : q;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / privacy mode — swallow */
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Public API ----

/** Enqueue a failed write for later retry. Called from the push
 *  paths in cloudState.ts and cloudRelational.ts. */
export function enqueue(
  table: string,
  op: QueueOp,
  payload: unknown,
  opts: QueueEntry['opts'] = {},
): void {
  const userId = getCloudStateUser();
  if (!userId) return; // not signed in — drop
  const q = readQueue();
  q.push({
    id: newId(),
    userId,
    table,
    op,
    payload,
    opts,
    attempts: 0,
    enqueuedAt: Date.now(),
  });
  writeQueue(q);
}

/** Best-effort replay of pending writes. Returns the number of
 *  entries that succeeded this pass. Safe to call concurrently —
 *  entries are de-duplicated by id. */
let draining = false;
export async function drain(): Promise<number> {
  if (draining) return 0;
  draining = true;
  let succeeded = 0;

  try {
    const currentUserId = getCloudStateUser();
    if (!currentUserId) return 0;

    let q = readQueue();
    if (q.length === 0) return 0;

    const remaining: QueueEntry[] = [];
    for (const entry of q) {
      // Only replay entries for the currently-signed-in user. A stale
      // entry from a prior account gets dropped when we detect it.
      if (entry.userId !== currentUserId) continue;

      const ok = await executeEntry(entry);
      if (ok) {
        succeeded += 1;
        continue;
      }
      const nextAttempt = entry.attempts + 1;
      if (nextAttempt >= MAX_ATTEMPTS) {
        console.error(
          `[cloudQueue] dropping entry after ${MAX_ATTEMPTS} attempts:`,
          entry.table, entry.op, entry.id,
        );
        continue;
      }
      remaining.push({ ...entry, attempts: nextAttempt });
    }

    // Merge with any entries enqueued DURING the drain (re-read fresh):
    // queue grows append-only so we can just concat the suffix that
    // postdates our starting snapshot.
    const latestQ = readQueue();
    const seenIds = new Set(q.map(e => e.id));
    const newlyAdded = latestQ.filter(e => !seenIds.has(e.id));
    writeQueue([...remaining, ...newlyAdded]);

    return succeeded;
  } finally {
    draining = false;
  }
}

async function executeEntry(entry: QueueEntry): Promise<boolean> {
  try {
    if (entry.op === 'upsert') {
      const { error } = await supabase
        .from(entry.table)
        .upsert(entry.payload as never, { onConflict: entry.opts.onConflict });
      return !error;
    }
    if (entry.op === 'delete') {
      const ids = entry.payload as string[];
      const col = entry.opts.filterColumn ?? 'id';
      let q = supabase.from(entry.table).delete().in(col, ids);
      if (entry.opts.scopeToUser) {
        q = q.eq('user_id', entry.userId);
      }
      const { error } = await q;
      return !error;
    }
  } catch {
    return false;
  }
  return false;
}

/** How many entries are currently waiting to replay. Useful for a
 *  "pending sync" indicator in the UI later. */
export function queuedCount(): number {
  return readQueue().length;
}

// ---- Triggers ----

let triggersInstalled = false;
let drainTimer: number | null = null;

/** Call once on app mount (after auth resolves) to start the drain
 *  loop and wire the focus + online handlers. Safe to call multiple
 *  times — only installs once. */
export function installDrainTriggers(): void {
  if (triggersInstalled) return;
  triggersInstalled = true;

  // Kick an initial drain on mount.
  void drain();

  // Window focus: user tabbed back, replay anything pending.
  window.addEventListener('focus', () => void drain());

  // Online: transition from offline → online, replay immediately.
  window.addEventListener('online', () => void drain());

  // Periodic safety net for transient server errors that don't
  // surface as `offline` events.
  drainTimer = window.setInterval(() => { void drain(); }, DRAIN_INTERVAL_MS);
}

/** Stop the drain timer (e.g., on sign-out). */
export function stopDrainTriggers(): void {
  if (drainTimer !== null) {
    window.clearInterval(drainTimer);
    drainTimer = null;
  }
}
