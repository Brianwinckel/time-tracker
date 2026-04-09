// ============================================================
// V6 Mobile Header — top bar with logo, title, dark mode, avatar
// ============================================================

import React from 'react';

interface Props {
  title: string;
  userName?: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAvatarClick?: () => void;
}

export const MobileHeader: React.FC<Props> = ({ title, userName, darkMode, onToggleDarkMode, onAvatarClick }) => {
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="md:hidden px-4 pt-3 pb-2 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white">
      {/* Logo */}
      <svg width="24" height="24" viewBox="0 0 32 32" className="shrink-0">
        <circle cx="10" cy="10" r="5" fill="#3b82f6" />
        <circle cx="22" cy="10" r="5" fill="#f97316" />
        <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
        <circle cx="22" cy="22" r="5" fill="#10b981" />
      </svg>

      <span className="text-base font-bold text-slate-900 flex-1 truncate">{title}</span>

      {/* Dark mode toggle */}
      <button
        onClick={onToggleDarkMode}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors"
        title={darkMode ? 'Light mode' : 'Dark mode'}
        aria-label="Toggle dark mode"
      >
        <span className="text-sm">{darkMode ? '☀' : '☾'}</span>
      </button>

      {/* Avatar */}
      <button
        onClick={onAvatarClick}
        className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0"
        aria-label="User menu"
      >
        {initials}
      </button>
    </header>
  );
};
