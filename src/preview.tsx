// Standalone preview entry point — mounts TaskPanelsApp with NO auth layer.
// The preview.html entry (div#preview-root) lets the UX be iterated on
// without going through Supabase / AuthGate. All the state and logic
// lives in <TaskPanelsApp />; this file only owns the CSS import + mount.

import { createRoot } from 'react-dom/client';
import './preview.css';
import { TaskPanelsApp } from './components/TaskPanelsApp';

createRoot(document.getElementById('preview-root')!).render(<TaskPanelsApp />);
