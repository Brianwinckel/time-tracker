import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIdleWarning } from './hooks/useIdleWarning';
import { useTimedTaskReminder } from './hooks/useTimedTaskReminder';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { DailySummary } from './components/DailySummary';
import { Settings } from './components/Settings';
import { BackdateBuilder } from './components/BackdateBuilder';
import { AuthScreen } from './components/AuthScreen';
import { TeamSelector } from './components/TeamSelector';
import { ManagerDashboard } from './components/ManagerDashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { BugReport } from './components/BugReport';

// Inner content — only rendered when authenticated + has team
const AppContent: React.FC = () => {
  const { state } = useApp();
  useKeyboardShortcuts();
  useIdleWarning();
  useTimedTaskReminder();

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      state.settings.darkMode ? 'dark' : 'light'
    );
  }, [state.settings.darkMode]);

  return (
    <div className="app">
      <Header />
      <main className="main">
        {state.view === 'dashboard' && <Dashboard />}
        {state.view === 'summary' && <DailySummary />}
        {state.view === 'manager' && <ManagerDashboard />}
        {state.view === 'admin' && <AdminPanel />}
        {state.view === 'history' && <BackdateBuilder />}
        {state.view === 'settings' && <Settings />}
      </main>
      <BugReport />
    </div>
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
