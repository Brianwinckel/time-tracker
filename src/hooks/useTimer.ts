// ============================================================
// Live timer hook — ticks every second for the active task
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { elapsedSince } from '../utils/time';

export function useTimer(startTime: string | null): number {
  const [elapsed, setElapsed] = useState<number>(
    startTime ? elapsedSince(startTime) : 0
  );
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

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(elapsedSince(startTimeRef.current));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}
