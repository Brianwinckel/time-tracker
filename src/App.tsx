import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { DailySummary } from './components/DailySummary';
import { Settings } from './components/Settings';
import { BackdateBuilder } from './components/BackdateBuilder';

const AppContent: React.FC = () => {
  const { state } = useApp();
  useKeyboardShortcuts();

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
        {state.view === 'history' && <BackdateBuilder />}
        {state.view === 'settings' && <Settings />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
