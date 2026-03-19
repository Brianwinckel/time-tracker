# TimeTracker

A local-first desktop-style web app for personal daily task and time tracking. Click large colored task panels to track your workday, then generate clean summaries to email your boss.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

- **Large colored task panels** — click to start/switch tasks instantly
- **Automatic time tracking** — switching tasks auto-timestamps start/end
- **Live timer** — shows elapsed time on the active task
- **Daily summary** — totals per task, chronological log, gap detection
- **Email summary** — copy-paste ready email with customizable template
- **CSV + text export** — download your timesheet
- **Manual entry** — backfill or correct time entries
- **Editable sessions** — fix start/end times after the fact
- **Custom tasks** — add, edit, delete, pin tasks with custom colors
- **Dark mode** — toggle with the button or press `D`
- **Keyboard shortcuts** — `1-9` for tasks, `Esc` to stop, `R` to resume
- **Persistent state** — survives refresh, restores active task + timer
- **Close warning** — warns if you try to close with an active task
- **Daily notes** — per-day and per-session notes

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`–`9` | Start task by position |
| `Esc` | Stop current task |
| `R` | Resume last task |
| `D` | Toggle dark mode |

## Project Structure

```
src/
├── types/          # TypeScript interfaces (Task, TimeEntry, Settings, etc.)
├── storage/        # localStorage adapter (swap for DB later)
├── context/        # React context + reducer for state management
├── hooks/          # useTimer, useKeyboardShortcuts
├── utils/          # Time formatting, summary generation, colors
└── components/     # All UI components
    ├── Dashboard.tsx       # Main tracker screen
    ├── TaskGrid.tsx        # Grid of task panels
    ├── TaskPanel.tsx       # Individual task card
    ├── ActiveTaskBar.tsx   # Current task + live timer bar
    ├── SessionLog.tsx      # Editable session list
    ├── DailySummary.tsx    # Summary screen with exports
    ├── Settings.tsx        # Email template + preferences
    ├── AddTaskModal.tsx    # Create new task
    ├── EditTaskModal.tsx   # Edit/delete task
    ├── ManualEntryForm.tsx # Backfill time entries
    ├── DailyNote.tsx       # Daily notes textarea
    └── Header.tsx          # Navigation + dark mode
```

## Data Storage

All data lives in `localStorage`. The storage layer (`src/storage/localStorage.ts`) uses a clean adapter pattern — to migrate to a database:

1. Create a new file (e.g., `src/storage/supabase.ts`)
2. Export the same function signatures
3. Update imports in `AppContext.tsx`

## Upgrade Path

- **Cloud sync**: Add Supabase/Firebase backend, replace localStorage adapter
- **Mobile support**: Already responsive; wrap with Capacitor for native
- **Auto email**: Add a backend API route to send emails via SendGrid/Resend
- **Manager reports**: Aggregate weekly/monthly data, add charts with Recharts

## Tech Stack

- React 18 + TypeScript
- Vite
- localStorage (zero backend)
- CSS variables for theming
