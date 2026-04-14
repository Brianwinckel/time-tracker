import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { EntitlementsProvider } from './billing/entitlements';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIdleWarning } from './hooks/useIdleWarning';
import { useTimedTaskReminder } from './hooks/useTimedTaskReminder';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/Dashboard';
import { HomeScreen } from './components/screens/HomeScreen';
import { DailySummary } from './components/DailySummary';
import { Settings } from './components/Settings';
import { BackdateBuilder } from './components/BackdateBuilder';
import { AuthScreen } from './components/AuthScreen';
import { TeamSelector } from './components/TeamSelector';
import { ManagerDashboard } from './components/ManagerDashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { PrepareSummary } from './components/screens/PrepareSummary';
import { DailySummaryScreen } from './components/screens/DailySummary';
import { FeedbackFab } from './components/FeedbackFab';

// Inner content — only rendered when authenticated + has team
const AppContent: React.FC = () => {
  const { state } = useApp();
  useKeyboardShortcuts();
  useIdleWarning();
  useTimedTaskReminder();

  return (
    <AppShell>
      {state.view === 'dashboard' && <HomeScreen />}
      {state.view === 'summary' && <DailySummary />}
      {state.view === 'manager' && <ManagerDashboard />}
      {state.view === 'admin' && <AdminPanel />}
      {state.view === 'prepare-summary' && <PrepareSummary />}
      {state.view === 'review' && <DailySummaryScreen />}
      {state.view === 'history' && <BackdateBuilder />}
      {state.view === 'settings' && <Settings />}
      <FeedbackFab />
    </AppShell>
  );
};

// Auth gate — checks login state and team assignment
const AuthGate: React.FC = () => {
  const { user, profile, loading } = useAuth();

  // Still checking auth state
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // Not logged in — show login screen
  if (!user) {
    return <AuthScreen />;
  }

  // Logged in but no team yet — show team selector
  if (profile && !profile.team_id) {
    return <TeamSelector />;
  }

  // Fully authenticated + has team — show the app
  return (
    <EntitlementsProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </EntitlementsProvider>
  );
};

// DEV ONLY: lightweight shell that matches concept layout exactly
// Used when ?preview is in the URL to bypass auth
const PreviewShell: React.FC = () => (
  <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
    {/* Desktop Sidebar — matches concept exactly */}
    <nav className="hidden md:flex w-16 bg-white border-r border-slate-100 flex-col items-center py-4 gap-1 shrink-0">
      <div className="mb-6">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="10" cy="10" r="5" fill="#3b82f6" />
          <circle cx="22" cy="10" r="5" fill="#f97316" />
          <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
          <circle cx="22" cy="22" r="5" fill="#10b981" />
        </svg>
      </div>
      <button className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600" title="Tracker">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      </button>
      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50" title="Summary">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </button>
      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50" title="Team">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50" title="Reports">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      </button>
      <div className="flex-1" />
      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50" title="Settings">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
      <div className="mt-2 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
        BW
      </div>
    </nav>

    {/* Main content column */}
    <div className="flex-1 flex flex-col overflow-hidden">
      <main className="flex-1 overflow-auto">
        <HomeScreen />
      </main>

      {/* Mobile Bottom Tab Bar — matches concept exactly: pb-6, font-semibold active */}
      <nav className="md:hidden bg-white border-t border-slate-100 px-2 pb-6 pt-2 flex items-center justify-around shrink-0">
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-blue-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          <span className="text-[10px] font-semibold">Tracker</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-[10px] font-medium">Summary</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-[10px] font-medium">Team</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </div>
  </div>
);

function App() {
  // DEV ONLY: ?preview bypasses auth to preview HomeScreen with mock data
  if (import.meta.env.DEV && window.location.search.includes('preview')) {
    return <PreviewShell />;
  }

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
