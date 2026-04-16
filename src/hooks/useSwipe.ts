import { useCallback, useRef } from 'react';

/**
 * Lightweight horizontal swipe detector for touch devices.
 *
 * Usage:
 *   const swipeHandlers = useSwipe({ onSwipeLeft: nextDay, onSwipeRight: prevDay });
 *   <div {...swipeHandlers}>...</div>
 *
 * Fires only when the gesture is clearly horizontal — the horizontal
 * displacement must exceed `threshold` AND must be larger than the
 * vertical displacement (so normal vertical scrolling is not triggered).
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      startX.current = null;
      startY.current = null;
      // Only fire when horizontal displacement dominates vertical.
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
