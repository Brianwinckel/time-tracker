// ============================================================
// TaskPanelsLogo — the 4-circle brand mark as a component.
//
// Pass `animated` to get a "breathing" loader where each dot
// scales in/out at a slightly different cadence, so the mark
// feels organic without being jarring. Each circle is given
// `transform-box: fill-box` via .logo-dot so its transform
// origin is its own center, not the SVG top-left (which is
// the default for SVG transforms). Animation keyframes and
// per-dot delay/duration classes live in src/preview.css.
// ============================================================

import React from 'react';

interface Props {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  /** When true, each dot breathes with a staggered cadence. */
  animated?: boolean;
  /** Extra classes for the wrapping <svg>. */
  className?: string;
}

export const TaskPanelsLogo: React.FC<Props> = ({
  size = 32,
  animated = false,
  className = '',
}) => {
  const dotClass = animated ? 'logo-dot' : '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="5" fill="#3b82f6" className={`${dotClass} logo-dot-1`} />
      <circle cx="22" cy="10" r="5" fill="#f97316" className={`${dotClass} logo-dot-2`} />
      <circle cx="10" cy="22" r="5" fill="#8b5cf6" className={`${dotClass} logo-dot-3`} />
      <circle cx="22" cy="22" r="5" fill="#10b981" className={`${dotClass} logo-dot-4`} />
    </svg>
  );
};
