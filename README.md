# TaskPanels

**From Panels to Proof** — A worker-first time tracking and proof-of-value app.

TaskPanels helps professionals document their effort, progress, blockers, and business value in a clean and realistic way. It goes beyond simple time tracking to capture *what* you worked on, *why* it mattered, *what got done*, and *what's still in motion*.

**Live:** [taskpanels.app](https://taskpanels.app)

---

## Table of Contents

- [Core Philosophy](#core-philosophy)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Database Schema](#database-schema)
- [File Structure](#file-structure)
- [Components](#components)
- [State Management](#state-management)
- [Storage Layer](#storage-layer)
- [Authentication](#authentication)
- [Edge Functions](#edge-functions)
- [PWA / Mobile](#pwa--mobile)
- [Tagging System](#tagging-system)
- [Email Summary](#email-summary)
- [Bug Reporting](#bug-reporting)
- [Scheduled Tasks](#scheduled-tasks)
- [Settings](#settings)
- [Roles & Permissions](#roles--permissions)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Known Issues & Fixes](#known-issues--fixes)
- [Future Roadmap](#future-roadmap)

---

## Core Philosophy

This is **not** employee surveillance software. TaskPanels is a tool that helps a professional answer:

- What did I work on?
- What value did it support?
- What got completed?
- What is still moving?
- What is waiting on others?
- What effort would otherwise go unseen?

Incomplete, shelved, or abandoned work is treated as **real effort** — not wasted time. The app explicitly tracks "Unrealized Effort" as a value category and surfaces shelved/scrapped work in daily summaries.

---

## Features

### Time Tracking
- Large colorful task panels for one-click task switching
- Automatic time tracking via task switching (click a task = start timer, click another = auto-stop previous)
- Click the active task again to toggle it off
- Live timer display on active task panel and sticky ActiveTaskBar
- Manual time entry for missed sessions
- Backdate builder for reconstructing past days
- Session notes — add context to any time entry
- Task note prompt on task start

### Structured Tagging (v2)
Each time entry can be tagged with 5 dimensions:
- **Project** — What the work supports (Website Refresh, Q2 Campaign, etc.)
- **Value Category** — Why it matters (Revenue, Growth, Unrealized Effort, etc.)
- **Work Style** — How it was done (Deep Work, Revisions, Collaboration, etc.)
- **Output Type** — What it produced (Video, Report, Slide Deck, etc.)
- **Session Status** — Outcome (In Progress, Completed, Blocked, Waiting for Review, Shelved, Scrapped)

Tags are **always optional** — the timer starts immediately, tags can be assigned during or after the session.

### Session Outcome Tracking
When a session ends, a SessionOutcomeModal appears (always skippable):
- **Completed?** checkbox with optional output type and completion note
- **Not completed?** status dropdown, "what's needed next", "blocked by", "carry forward tomorrow?"

### Break & Lunch
- Compact pill buttons (not full task panels) in a utility row below the task grid
- Built-in countdown timers (Lunch: 30m, Break: 15m by default)
- Push notification reminders when time is up
- Overtime indicator if you go over

### Daily Summary & Email
- Date picker with forward/back arrows to browse past summaries
- Charts: Time by Project, Value Breakdown, Value Distribution (stacked bar)
- Status count badges (Completed, Blocked, Waiting, etc.)
- Enhanced email with sections: Time by Project, Value Breakdown, Completed, In Progress, Needs Follow-up / Pass-off, Shelved/Scrapped
- One-click Send Email (via mailto:), Copy Email, Copy Summary, Export CSV

### End My Day Flow
- Stops the active task
- Shows a review of the day's sessions
- Prompts to tag un-tagged entries before generating the email

### Charts & Reporting
- Horizontal bar charts (time by project, time by value category, time by task)
- Stacked bar (Completed Value vs In-Progress vs Unrealized Effort)
- Status count badges
- All built with pure CSS — no charting library dependency

### Manager Dashboard
- Live view of team members' current tasks (realtime via Supabase Postgres Changes)
- Employee drill-down cards
- Date picker for historical view

### Admin Panel
- Team management (create/edit teams)
- User management (list users, change roles, assign teams)
- Task preset management per team
- Invite users by email

### Bug Reporting
- Floating bug button (always visible, bottom-right)
- Captures: description, severity, current page, device info, screen size
- Saved to `bug_reports` table in Supabase
- Email notification sent to admin via Resend Edge Function
- Automated bug triage via scheduled task (every 4 hours)

### Other
- Dark mode with system detection
- Keyboard shortcuts (1-9 start tasks, Esc stop, R resume, D toggle dark mode)
- Drag-and-drop task reordering (long-press on mobile)
- PWA installable on iOS and Android Home Screen
- Push notifications for idle warnings and break/lunch timers
- Offline-capable with localStorage cache
- Pinch zoom disabled for native app feel on mobile

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| State | Context + useReducer (single reducer pattern) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Email | Resend API (via Supabase Edge Functions) |
| Hosting | Vercel (auto-deploy from main branch) |
| PWA | Service Worker + Web App Manifest |
| Push | Web Push API with VAPID keys |

---

## Architecture

```
Browser (React SPA)
  |
  |-- AppContext (useReducer) -----------> UI Components
  |       |
  |       v
  |-- Hybrid Storage Layer
  |       |-- localStorage (instant cache)
  |       |-- Supabase (debounced 500ms, source of truth)
  |       |-- Merge strategy on load (prevents data loss)
  |
Supabase
  |-- PostgreSQL (11 tables, all RLS-enabled)
  |-- Auth (magic link, email/password, password reset)
  |-- Realtime (postgres_changes for manager dashboard)
  |-- Edge Functions (daily-email, bug-report-notify)
  |
Vercel
  |-- Static site hosting
  |-- Auto-deploy from GitHub
```

### Data Flow
1. User logs in -> AuthContext loads profile from `profiles` table
2. AppContext initializes -> loads tasks/entries/settings/tagOptions from Supabase (via hybrid layer)
3. User edits -> instant localStorage write + debounced Supabase write
4. App goes to background -> `visibilitychange` event flushes all pending writes
5. App reopens -> entries are **merged** (remote + local union by ID) to prevent data loss
6. Sign out -> `flushPendingWrites()`, clear session

---

## Data Model

### Core Types (`src/types/index.ts`)

```typescript
interface Task {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isPinned: boolean;
  createdAt: string;
  order: number;
  timerMinutes: number;  // 0 = no timer, >0 = countdown with push reminder
}

interface TimeEntry {
  id: string;
  taskId: string;
  taskName: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // ISO timestamp
  endTime: string | null;
  duration: number | null; // milliseconds
  note: string;
  // v2 tagging
  projectId: string | null;
  valueCategory: string | null;
  workStyle: string | null;
  outputType: string | null;
  sessionStatus: string;       // default: 'In Progress'
  isCompleted: boolean;
  completionNote: string;
  nextSteps: string;
  blockedBy: string;
  carryForward: boolean;
}

interface TagOption {
  id: string;
  userId: string;
  category: TagCategory; // 'project' | 'value_category' | 'work_style' | 'output_type' | 'session_status'
  value: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isArchived: boolean;
}

interface Settings {
  bossName: string;
  myName: string;
  emailSubjectFormat: string;
  greeting: string;
  signoff: string;
  timeFormat: '12h' | '24h';
  darkMode: boolean;
  idleWarningMinutes: number;
  autoEmailEnabled: boolean;
  autoEmailRecipient: string;   // comma-separated
  autoEmailTime: string;        // HH:MM
  autoEmailMinHours: number;
  autoEmailMaxGapMin: number;
}
```

---

## Database Schema

All tables have Row Level Security (RLS) enabled. Supabase project ID: `mlfzuzazgchnofgxbadq`

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profiles (id, email, name, role, team_id) | Users read own + team members |
| `teams` | Team definitions (id, name) | Read by members |
| `team_tasks` | Admin-managed task presets per team | Read by team members |
| `tasks` | Per-user task list (id, name, color, order, timer_minutes) | Users CRUD own |
| `time_entries` | Time tracking entries with 10 tagging columns | Users CRUD own, managers read team |
| `user_settings` | Per-user settings (email template, preferences) | Users CRUD own |
| `daily_notes` | Per-user per-date notes | Users CRUD own |
| `user_tag_options` | Customizable tag lists per user per category | Users CRUD own |
| `push_subscriptions` | Web Push subscription endpoints | Users CRUD own |
| `bug_reports` | Bug reports with severity, device info | Users insert own, admins read all |
| `email_send_log` | Tracks auto-email sends to prevent duplicates | System use |

### Key Triggers
- `create_profile_on_signup` — Auto-creates a `profiles` row when a new auth user signs up
- `create_settings_on_profile` — Auto-creates `user_settings` row for new profiles
- `seed_tag_options_on_profile` — Seeds default tag options for new users (projects, value categories, work styles, output types, session statuses)

---

## File Structure

```
src/
  App.tsx                          # Root component, auth gate, routing
  main.tsx                         # React entry point
  types/index.ts                   # All TypeScript interfaces & types
  context/
    AppContext.tsx                  # Central reducer + state + persistence
    AuthContext.tsx                 # Auth state, profile, session management
  storage/
    index.ts                       # Hybrid layer (merge strategy, debounce, flush)
    localStorage.ts                # Browser cache adapter
    supabase.ts                    # Supabase DB adapter
  lib/
    supabase.ts                    # Supabase client singleton
  hooks/
    useTimer.ts                    # Live elapsed time hook
    useIdleWarning.ts              # Idle detection + push notification
    useTimedTaskReminder.ts        # Break/Lunch countdown + push
    useKeyboardShortcuts.ts        # Keyboard shortcut handler
    useRealtimeEntries.ts          # Realtime subscription for manager dashboard
  utils/
    time.ts                        # Time formatting, date helpers
    colors.ts                      # Task color palette, contrast text
    defaults.ts                    # Default tasks + settings
    summary.ts                     # Email generation, aggregation, CSV export
    push.ts                        # Web Push subscription helpers
  components/
    Header.tsx                     # App header with nav, avatar dropdown, hamburger
    Dashboard.tsx                  # Main tracker screen
    TaskGrid.tsx                   # Task panel grid + drag reorder + break buttons
    TaskPanel.tsx                  # Individual task card with countdown
    ActiveTaskBar.tsx              # Sticky bar with timer + inline tag selectors
    SessionLog.tsx                 # Today's sessions with tag badges + editing
    SessionOutcomeModal.tsx        # End-of-session completion/status modal
    TagSelector.tsx                # Reusable chip/pill tag selector
    SimpleChart.tsx                # SVG bar charts, stacked bars, status badges
    DailySummary.tsx               # Summary page with charts + date navigation
    EndMyDay.tsx                   # End-of-day flow (stop task, review, email)
    ManualEntryForm.tsx            # Manual time entry
    BackdateBuilder.tsx            # Reconstruct past days
    DailyNote.tsx                  # Per-day notes
    TaskNotePrompt.tsx             # Note prompt on task start
    AddTaskModal.tsx               # Add new task
    EditTaskModal.tsx              # Edit/delete task (with timer field)
    Settings.tsx                   # Full settings with tag list management
    AuthScreen.tsx                 # Login/signup screen
    TeamSelector.tsx               # First-login team picker
    BugReport.tsx                  # Floating bug report button + modal
    ManagerDashboard.tsx           # Live team view for managers
    EmployeeCard.tsx               # Per-employee status card
    admin/
      AdminPanel.tsx               # Admin tabs (teams, users, invites)
      TeamEditor.tsx               # Team + task preset CRUD
      UserTable.tsx                # User list + role management
      InviteForm.tsx               # Email invite form
public/
  sw.js                            # Service worker (offline + push)
  manifest.json                    # PWA manifest
  logo-light.svg                   # Logo (light mode)
  logo-dark.svg                    # Logo (dark mode)
  icon-192.png                     # PWA icon 192x192
  icon-512.png                     # PWA icon 512x512
  favicon.svg                      # Favicon (green checkbox)
```

---

## Components

### Core Flow
1. `App.tsx` — Auth gate: shows `AuthScreen` if not logged in, `TeamSelector` if no team, then renders the main app with `Header` + routed view
2. `Dashboard` — Main screen: `ActiveTaskBar` + `TaskGrid` + `SessionLog` + `DailyNote` + `ManualEntryForm`
3. `DailySummary` — Charts + email preview with date navigation
4. `Settings` — All configuration including tag list management (5 TagListEditor sections)

### Tag System UI
- `TagSelector` — Reusable chip selector used everywhere (ActiveTaskBar, SessionLog, SessionOutcomeModal, ManualEntryForm)
- `SessionOutcomeModal` — Appears when a session ends, captures completion/status/blockers
- Tags are stored as text on `time_entries`, not foreign keys — keeps queries simple and entries readable even if tag options change

---

## State Management

Single reducer in `AppContext.tsx` with these action types:

| Action | Purpose |
|--------|---------|
| `START_TASK` | Start a new entry (auto-stops previous) |
| `STOP_TASK` | Stop the active entry |
| `RESUME_LAST_TASK` | Resume the most recent task |
| `ADD_TASK` / `UPDATE_TASK` / `DELETE_TASK` | Task CRUD |
| `UPDATE_ENTRY` / `DELETE_ENTRY` / `ADD_MANUAL_ENTRY` | Entry CRUD |
| `SET_ENTRY_NOTE` | Update just the note on an entry |
| `SET_ENTRY_TAGS` | Update tag fields on an entry (partial update) |
| `SET_DAILY_NOTE` | Update the daily note |
| `UPDATE_SETTINGS` | Partial settings update |
| `SET_VIEW` | Navigate between views |
| `NEW_DAY` | Date change detection |
| `LOAD_STATE` | Bulk state update (init, day change) |
| `REORDER_TASKS` | Drag-and-drop reorder |
| `LOAD_TAG_OPTIONS` / `ADD_TAG_OPTION` / `UPDATE_TAG_OPTION` / `DELETE_TAG_OPTION` | Tag option CRUD |

---

## Storage Layer

The hybrid storage layer (`src/storage/index.ts`) is the critical piece that prevents data loss.

### Write Path
1. **Instant** write to localStorage (user sees it immediately)
2. **Debounced** (500ms) write to Supabase

### Read Path (Entries — most important)
1. Flush any pending debounced writes for this date
2. Load from Supabase
3. Load from localStorage
4. **Merge** both sets by entry ID:
   - Entries in remote but not local = keep (synced from another device)
   - Entries in local but not remote = keep (unflushed writes)
   - Entries in both = use remote version (authoritative)
5. Cache the merged result in localStorage

### Flush Triggers
- `beforeunload` — browser tab closing
- `visibilitychange: hidden` — app goes to background (critical on mobile)
- Sign out button

---

## Authentication

Handled by `AuthContext.tsx` using Supabase Auth:

- **Magic link (OTP)** — passwordless email login
- **Email + password** — traditional login/signup
- **Password reset** — via email
- **Profile** auto-created on signup via database trigger

Roles: `employee` (default), `manager`, `admin`

---

## Edge Functions

Deployed on Supabase (Deno runtime):

| Function | Purpose | JWT Required |
|----------|---------|-------------|
| `daily-email` | Sends automated daily summary emails via Resend | Yes |
| `bug-report-notify` | Sends email notification to admin when a bug is reported | Yes |

### Secrets (set in Supabase Dashboard > Edge Functions > Secrets)
- `RESEND_API_KEY` — Resend API key for sending emails
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push VAPID keys

---

## PWA / Mobile

- `manifest.json` with `display: standalone` for native app feel
- Service worker (`sw.js`) with network-first caching for app shell
- `viewport` meta tag with `user-scalable=no` to disable pinch zoom
- `touch-action: manipulation` on body to prevent double-tap zoom
- iOS: Add to Home Screen via Safari Share menu
- Android: "Install app" prompt in Chrome

### Push Notifications
- Uses Web Push API with VAPID keys
- Supported on: Android (Chrome), Desktop (all browsers), iOS 16.4+ (Home Screen PWA only)
- Used for: idle warnings, break/lunch timer reminders

---

## Tagging System

### How Tags Work
- 5 tag categories: project, value_category, work_style, output_type, session_status
- Stored as `text` columns on `time_entries` (not foreign keys)
- User's available options stored in `user_tag_options` table
- Default options seeded on signup via database trigger
- Users can add, rename, and archive options in Settings
- Archiving hides from selectors but preserves existing entry data

### Default Tag Options

**Projects:** General, Website Refresh, Q2 Campaign, Internal Ops, Product Launch, Client A, Reporting Dashboard

**Value Categories:** Revenue, Growth, Operations, Support, Strategy, Compliance, Relationship Building, Enablement, Technical Debt Reduction, Knowledge Building, Unrealized Effort

**Work Styles:** Deep Work, Revisions, Revisiting, Collaboration, Quick Task, Review, Approval Support, Problem Solving, Maintenance

**Output Types:** Video, Report, Slide Deck, Landing Page, Campaign, Documentation, Research Summary, Design Concept, Strategy Draft, Internal Recommendation

**Session Statuses:** In Progress, Completed, Waiting for Review, Waiting for Approval, Blocked, Deferred, Shelved, Scrapped

---

## Email Summary

The generated email includes these sections:

1. **Time by Project** — duration breakdown per project
2. **Value Breakdown** — duration per value category (highlights Unrealized Effort)
3. **Completed** — numbered list with output types and completion notes
4. **In Progress** — work that's still moving
5. **Needs Follow-up / Pass-off** — items with status Waiting/Blocked/Deferred, including next steps and who it's waiting on
6. **Shelved / Scrapped / Unrealized Effort** — work that mattered but didn't ship
7. **Detailed Log** — chronological session log
8. **Total tracked time**

### Auto Email Protections
- Minimum tracked hours threshold (default: 8h)
- Maximum gap detection (default: 2h)
- Won't send if user has an active task running
- Configurable send time

---

## Bug Reporting

- Floating bug button always visible in bottom-right corner
- Modal captures: description, severity (Minor/Moderate/Critical), auto-captures page, device, screen size
- Saved to `bug_reports` table in Supabase
- Admin notified via email (Resend Edge Function)
- Automated triage every 4 hours via Claude scheduled task

---

## Scheduled Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| `bug-triage` | Every 4 hours | Reads unresolved bug reports, investigates code, reports diagnosis with proposed fix. Does not auto-fix — waits for approval. |

---

## Settings

Users can configure:
- **Email Template** — name, boss name, subject format, greeting, sign-off
- **Projects** — add/rename/archive project options
- **Value Categories** — add/rename/archive value category options
- **Output Types** — add/rename/archive
- **Work Styles** — add/rename/archive
- **Session Statuses** — add/rename/archive
- **Auto Daily Email** — enable/disable, recipients (comma-separated), send time, min hours, max gap
- **Push Notifications** — enable/disable
- **Preferences** — time format (12h/24h), idle warning minutes, dark mode

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| `employee` | Track time, manage own tasks/tags/settings, view own summaries, submit bug reports |
| `manager` | All employee capabilities + live team dashboard + view team members' entries |
| `admin` | All manager capabilities + manage teams + manage task presets + manage users + invite users |

RLS policies enforce these at the database level.

---

## Environment Variables

### Vercel (set in project settings)
```
VITE_SUPABASE_URL=https://mlfzuzazgchnofgxbadq.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### Supabase Edge Function Secrets
```
RESEND_API_KEY=<resend-api-key>
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
```

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local with Supabase credentials
echo "VITE_SUPABASE_URL=https://mlfzuzazgchnofgxbadq.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=your-key-here" >> .env.local

# Start dev server
npm run dev

# Type check
npx tsc -b

# Build for production
npm run build
```

---

## Deployment

### Vercel
The app auto-deploys from the `main` branch on GitHub. Manual deploy:
```bash
npx vercel deploy --prod
```

### Supabase Edge Functions
Edge functions are deployed via the Supabase MCP tools or CLI:
```bash
supabase functions deploy daily-email
supabase functions deploy bug-report-notify
```

---

## Known Issues & Fixes

| Date | Issue | Fix |
|------|-------|-----|
| 2026-03-24 | Data loss on app reopen — entries missing after force-closing during "loading" state | Rewrote `storage/index.ts` `loadEntries()` to merge remote + local entries by ID instead of replacing. Added `visibilitychange` flush handler so pending writes are saved when app goes to background on mobile. |
| 2026-03-24 | Bug report modal covered by keyboard on mobile | Changed modal alignment from `flex-end` to `flex-start` with top padding on mobile, centered on desktop |
| 2026-03-24 | "Invalid API Key" on magic link | Verified Supabase anon key in Vercel environment variables |
| 2026-03-24 | "Database error querying schema" on login | Fixed circular RLS dependency with SECURITY DEFINER function for profile loading |

---

## Future Roadmap

- [ ] Weekly / monthly summary reports
- [ ] Team-level value reporting for managers
- [ ] pg_cron trigger for automated daily emails
- [ ] Carry-forward feature (auto-create entries from yesterday's unfinished work)
- [ ] Time estimates per task/project
- [ ] Billable vs non-billable tracking
- [ ] API integrations (Jira, Asana, Teams)
- [ ] Offline queue with conflict resolution
- [ ] Data export (full account export)
- [ ] Admin bug report viewer in-app
