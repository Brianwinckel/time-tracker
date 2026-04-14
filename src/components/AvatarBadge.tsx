// ============================================================
// AvatarBadge — small reusable avatar with sensible fallbacks
// ------------------------------------------------------------
// Used by:
//   * HomeScreen mobile header
//   * Desktop sidebar profile button
//   * Mobile bottom tab bar profile button
//   * ProfileScreen identity card
//
// Render order:
//   1. avatarDataUrl present  → <img>
//   2. name present           → initials over gradient
//   3. nothing                → person icon over slate
// ============================================================

import React from 'react';
import { getInitials, resolveAvatarUrl, type UserProfile } from '../lib/profile';

interface AvatarBadgeProps {
  profile: UserProfile;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Use rounded-full (default) or rounded-2xl (large profile card). */
  shape?: 'circle' | 'square';
  className?: string;
}

const SIZE_MAP: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-20 h-20 text-2xl',
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  profile,
  size = 'sm',
  shape = 'circle',
  className = '',
}) => {
  const sizeClass = SIZE_MAP[size];
  const radius = shape === 'square' ? 'rounded-2xl' : 'rounded-full';
  const initials = getInitials(profile.name);
  const photoUrl = resolveAvatarUrl(profile);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Avatar"
        className={`${sizeClass} ${radius} object-cover border border-slate-200 ${className}`}
      />
    );
  }

  if (initials) {
    return (
      <div
        className={`${sizeClass} ${radius} bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold ${className}`}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${radius} bg-slate-200 flex items-center justify-center text-slate-500 ${className}`}
      aria-hidden
    >
      <svg
        className="w-1/2 h-1/2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    </div>
  );
};
