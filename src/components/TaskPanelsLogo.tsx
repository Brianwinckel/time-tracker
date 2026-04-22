// ============================================================
// TaskPanelsLogo — the 4-circle brand mark as a component.
//
// Brand arrangement (top-left → clockwise):
//   blue · green
//   orange · purple
//
// Props:
//  - `wordmark`: render the "TaskPanels" text next to the mark.
//    Without it, you get just the 32×32 icon.
//  - `animated`: each dot breathes with a staggered cadence for
//    the loading-gate state. Each circle gets `transform-box:
//    fill-box` via .logo-dot so its transform origin is its own
//    center, not the SVG top-left. Keyframes and per-dot classes
//    live in src/preview.css.
// ============================================================

import React from 'react';

interface Props {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  /** When true, each dot breathes with a staggered cadence. */
  animated?: boolean;
  /** When true, render "TaskPanels" wordmark next to the mark. */
  wordmark?: boolean;
  /** Extra classes for the wrapping element. */
  className?: string;
}

export const TaskPanelsLogo: React.FC<Props> = ({
  size = 32,
  animated = false,
  wordmark = false,
  className = '',
}) => {
  const dotClass = animated ? 'logo-dot' : '';
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={wordmark ? undefined : className}
    >
      {/* top-left: blue */}
      <circle cx="10" cy="10" r="5" fill="#3b82f6" className={`${dotClass} logo-dot-1`} />
      {/* top-right: green */}
      <circle cx="22" cy="10" r="5" fill="#10b981" className={`${dotClass} logo-dot-2`} />
      {/* bottom-left: orange */}
      <circle cx="10" cy="22" r="5" fill="#f97316" className={`${dotClass} logo-dot-3`} />
      {/* bottom-right: purple */}
      <circle cx="22" cy="22" r="5" fill="#8b5cf6" className={`${dotClass} logo-dot-4`} />
    </svg>
  );

  if (!wordmark) return mark;

  // Wordmark variant: mark + "TaskPanels" text, sized proportionally.
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span
        className="font-bold tracking-tight text-slate-900"
        style={{ fontSize: Math.round(size * 0.72), lineHeight: 1 }}
      >
        TaskPanels
      </span>
    </span>
  );
};
