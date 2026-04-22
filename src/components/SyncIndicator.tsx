// ============================================================
// SyncIndicator — shows cloud-sync state when it's NOT "all good".
//
// Rendering rules (minimize noise):
//   - Online and queue empty        → renders nothing
//   - Offline                       → amber chip "Offline"
//   - Online and queue non-empty    → blue chip with pending count
//
// Click drains the queue immediately (useful when the user knows
// they're back online and wants to force a sync). Idempotent; a
// click while nothing's pending is a no-op.
//
// Poll the queue count every 5s (localStorage reads are cheap)
// and also listen for online/offline events for instant updates.
// ============================================================

import React, { useEffect, useState } from 'react';
import { queuedCount, drain } from '../lib/cloudQueue';

const POLL_MS = 5_000;

export const SyncIndicator: React.FC = () => {
  const [pending, setPending] = useState<number>(queuedCount);
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    const tick = () => setPending(queuedCount());
    const onOnline = () => { setOnline(true); tick(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(id);
    };
  }, []);

  const handleClick = async () => {
    if (draining) return;
    setDraining(true);
    try {
      await drain();
      setPending(queuedCount());
    } finally {
      setDraining(false);
    }
  };

  // Happy path: render nothing, keep the UI quiet.
  if (online && pending === 0) return null;

  const offline = !online;
  const label = offline
    ? 'Offline'
    : draining
      ? 'Syncing…'
      : `${pending} pending`;
  const hint = offline
    ? 'Changes are saved locally and will sync when you reconnect.'
    : draining
      ? 'Flushing queued writes…'
      : 'Tap to sync now.';

  const palette = offline
    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={offline || draining}
      title={hint}
      aria-label={label}
      className={`fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition-colors ${palette} disabled:cursor-not-allowed disabled:opacity-80`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${offline ? 'bg-amber-500' : 'bg-blue-500'}`} />
      {label}
    </button>
  );
};
