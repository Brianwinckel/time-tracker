// ============================================================
// App header — compact nav with user dropdown menu
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDateLong } from '../utils/time';
import type { AppState } from '../types';

export const Header: React.FC = () => {
  const { state, dispatch } = useApp();
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  const navItems: { view: AppState['view']; label: string; show: boolean }[] = [
    { view: 'dashboard', label: 'Tracker', show: true },
    { view: 'summary', label: 'Summary', show: true },
    { view: 'manager', label: 'Team', show: isManagerOrAdmin },
    { view: 'admin', label: 'Admin', show: isAdmin },
    { view: 'history', label: 'Backdate', show: true },
  ];

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNav = (view: AppState['view']) => {
    dispatch({ type: 'SET_VIEW', view });
    setNavOpen(false);
    setMenuOpen(false);
  };

  const displayName = profile?.name || profile?.email || '';
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <header className="header">
      <div className="header__left">
        <h1 className="header__title" onClick={() => handleNav('dashboard')} style={{ cursor: 'pointer' }}>
          <img
            src={state.settings.darkMode ? '/logo-dark.svg' : '/logo-light.svg'}
            alt="TaskPanels"
            className="header__logo-img"
          />
        </h1>
        <span className="header__date">{formatDateLong(state.currentDate)}</span>
      </div>

      <div className="header__right">
        {/* Desktop nav — hidden on mobile */}
        <nav className="header__nav header__nav--desktop">
          {navItems.filter(i => i.show).map(item => (
            <button
              key={item.view}
              className={`header__nav-btn ${state.view === item.view ? 'header__nav-btn--active' : ''}`}
              onClick={() => handleNav(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="header__mobile-nav" ref={navRef}>
          <button
            className="header__hamburger"
            onClick={() => { setNavOpen(!navOpen); setMenuOpen(false); }}
            aria-label="Navigation menu"
          >
            <span className="header__hamburger-line" />
            <span className="header__hamburger-line" />
            <span className="header__hamburger-line" />
          </button>

          {navOpen && (
            <div className="header__dropdown header__dropdown--nav">
              {navItems.filter(i => i.show).map(item => (
                <button
                  key={item.view}
                  className={`header__dropdown-item ${state.view === item.view ? 'header__dropdown-item--active' : ''}`}
                  onClick={() => handleNav(item.view)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dark mode toggle — always visible */}
        <button
          className="header__dark-toggle"
          onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { darkMode: !state.settings.darkMode } })}
          title="Toggle dark mode (D)"
        >
          {state.settings.darkMode ? '\u2600' : '\u263E'}
        </button>

        {/* User avatar + dropdown */}
        {profile && (
          <div className="header__user-menu" ref={menuRef}>
            <button
              className="header__avatar"
              onClick={() => { setMenuOpen(!menuOpen); setNavOpen(false); }}
              title={displayName}
            >
              {initials}
            </button>

            {menuOpen && (
              <div className="header__dropdown header__dropdown--user">
                <div className="header__dropdown-header">
                  <span className="header__dropdown-name">{displayName}</span>
                  <span className="header__dropdown-email">{profile.email}</span>
                  <span className="header__dropdown-role">{profile.role}</span>
                </div>
                <div className="header__dropdown-divider" />
                <button
                  className="header__dropdown-item"
                  onClick={() => handleNav('settings')}
                >
                  Settings
                </button>
                <div className="header__dropdown-divider" />
                <button
                  className="header__dropdown-item header__dropdown-item--danger"
                  onClick={async () => {
                    setMenuOpen(false);
                    localStorage.clear();
                    await signOut();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
