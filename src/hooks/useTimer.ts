// ============================================================
// Live timer hook — ticks every second for the active task
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { elapsedSince } from '../utils/time';

export function useTimer(startTime: string | null): number {
  const [elapsed, setElapsed] = useState<number>(
    startTime ? elapsedSince(startTime) : 0
  );
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(startTime);

  // Keep ref in sync
  useEffect(() => {
    startTimeRef.current = startTime;
    if (!startTime) {
      setElapsed(0);
      return;
    }
    setElapsed(elapsedSince(startTime));
  }, [startTime]);

  useEffect(() => {
    if (!startTime) return;

    let lastUpdate = Date.now();

    const tick = () => {
      const now = Date.now();
      // Update every ~1 second
      if (now - lastUpdate >= 1000) {
        lastUpdate = now;
        if (startTimeRef.current) {
          setElapsed(elapsedSince(startTimeRef.current));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startTime]);

  return elapsed;
}
