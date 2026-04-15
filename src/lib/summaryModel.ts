// ============================================================
// TaskPanels Summary Model
// ------------------------------------------------------------
// Pure, no React, no DOM, no context. This module is the
// contract between the deterministic work-capture layer and
// whatever eventually turns captured work into a narrative —
// template functions today, an LLM call tomorrow.
//
// Design rules (from the roadmap):
//   1. TaskPanels captures the truth. Generators only shape it.
//   2. Structured in, structured out. No freeform-prompt soup.
//   3. Source-aware from day one. The payload carries a slot for
//      Claude / Browser digests even though only taskpanels is
//      populated today.
//   4. Generators are pluggable per ReportKind so future report
//      types (weekly, client, internal, personal) drop in.
//   5. Downstream screens render the typed output — they never
//      reach back into raw edit state.
// ============================================================

import type { PanelKind, MeetingType, MeetingAudience } from './panelCatalog';

// ---------- Shared enums ----------

export type ReportKind =
  | 'daily'
  | 'performance'
  | 'weekly'
  | 'client'
  | 'internal'
  | 'personal';

export type Audience = 'manager' | 'team' | 'client' | 'personal';
export type SummaryStyle = 'concise' | 'standard' | 'detailed';

export type PanelOutcome =
  | 'completed'
  | 'in-progress'
  | 'blocked'
  | 'review'
  | 'follow-up'
  | 'abandoned';

export type SourceId = 'taskpanels' | 'claude' | 'browser';

/** The generator pipeline currently runs deterministic templates.
 *  When the AI Summary Assistant lands, the same generators accept
 *  `mode: 'ai'` and internally call the model. Downstream consumers
 *  don't care which mode produced the output. */
export type GeneratorMode = 'deterministic' | 'ai';

// ---------- Per-workstream raw entry (from tracked panels) ----------

export interface FollowUpDetails {
  waitingOn: string;
  passedOffTo: string;
  nextStep: string;
}

export interface WorkstreamEntry {
  panelId: string;
  name: string;
  /** Tailwind background class used for the color bar, e.g. 'bg-blue-500'. */
  barClass: string;
  /** Hex form of the same accent, handy for SVG fills in charts. */
  colorHex: string;
  project?: string;
  workType?: string;
  focusNote?: string;
  notes?: string;
  tags: string[];
  sessionState?: string;
  trackedMs: number;
  /** Session type at the Panel-instance level. 'work' is the default and
   *  what every legacy panel lands as. 'meeting' is opted into via the
   *  Start-a-Meeting entry point on PickPanel. Kept separate from
   *  workType (coding / design / etc.) because meetings have their own
   *  reporting axis. */
  kind: PanelKind;
  /** Derived: true when kind === 'meeting' OR legacy workType === 'Meeting'.
   *  The fallback keeps summaries generated before the meeting refactor
   *  rendering correctly (their drafts still use the old chip). */
  isMeeting: boolean;
  /** Meeting-only: planned vs impromptu. Undefined on work panels. */
  meetingType?: MeetingType;
  /** Meeting-only: who the meeting is with. Undefined on work panels. */
  audience?: MeetingAudience;
  /** Meeting-only: the purpose string ("What is this meeting about?").
   *  Mirrors focusNote in the report UI but carried separately so the
   *  narrative writer can label it correctly. */
  topic?: string;
  included: boolean;
  outcome: PanelOutcome | null;
  followUp: FollowUpDetails;
  blocker: string;
  unrealizedEffort: boolean | null;
}

// ---------- Per-run segment (the unit the timeline walks) ----------

/** Either a Panel instance id, or a sentinel for non-work runs:
 *  '__break__' / '__lunch__' / '__idle__'. The summary generator
 *  pattern-matches on these strings to render break rows. */
export type RunPanelId = string;

export interface RunSegment {
  /** Panel instance id, or one of the sentinel strings above. */
  panelId: RunPanelId;
  /** Epoch ms. Carried as numbers (not Dates) so the payload is JSON-safe. */
  startedAt: number;
  endedAt: number;
}

// ---------- Source digests ----------

/** The canonical TaskPanels source: everything we captured about
 *  the user's work during the report window. */
export interface TaskPanelsSource {
  kind: 'taskpanels';
  /** ISO date (start of window) for display. */
  date: string;
  totalTrackedMs: number;
  /** Work that isn't meetings. */
  focusMs: number;
  /** Time whose workType is 'Meeting'. */
  meetingMs: number;
  /** Accumulated break + lunch time, not counted in focus/meeting. */
  breakMs: number;
  workstreams: WorkstreamEntry[];
  /** Append-only run log within the report window. The Daily Summary
   *  timeline walks this in time order to render a real time-of-day
   *  axis (instead of one row per workstream). */
  runs: RunSegment[];
  /** Threshold above which extra tracked time is flagged as overtime.
   *  Defaults to 8h; can be set per-user in a future setting. */
  overtimeThresholdMs: number;
}

/** Placeholder shape for the future Claude / Browser digests.
 *  Per the roadmap these will ship as structured digests, not
 *  raw transcripts. We only need the fields today's UI already
 *  renders (label, badge, on/off) — the rest gets fleshed out
 *  when the ingestion pipeline is real. */
export interface ExternalDigest {
  kind: 'claude' | 'browser';
  label: string;
  summary?: string;
  itemCount?: number;
}

// ---------- The normalized report payload ----------

export interface SummaryInput {
  reportKind: ReportKind;
  audience: Audience;
  style: SummaryStyle;
  /** The window this report describes. start/end are ISO strings so
   *  the payload stays JSON-safe (important when we POST it to the
   *  model API later). `label` is the presentation string. */
  dateRange: { start: string; end: string; label: string };
  sources: {
    taskpanels: TaskPanelsSource;
    claude?: ExternalDigest;
    browser?: ExternalDigest;
  };
  includedSourceIds: SourceId[];
  /** Reserved for the future AI Summary Assistant toggle. */
  mode: GeneratorMode;
}

// ---------- Shared output primitives ----------

export interface KPI {
  label: string;
  value: string;
  sub?: string;
}

export interface LegendEntry {
  panelId: string;
  name: string;
  shortName: string;
  time: string;
  colorHex: string;
  barClass: string;
  pct: number;
  isMeeting: boolean;
}

/** A timeline entry can be a tracked work segment or a non-work pause.
 *  Both share a start/end so the renderer can pin them to time-of-day. */
export type TimelineEntryKind = 'work' | 'break' | 'lunch';

export interface TimelineEntry {
  /** Stable id for React keys (synthesized when no run id is available). */
  id: string;
  /** For work rows: the Panel instance id. For breaks: the sentinel string. */
  panelId: string;
  kind: TimelineEntryKind;
  name: string;
  barClass: string;
  /** Hex form of the same accent. Used for the timeline dot's fill so it
   *  paints even when Tailwind's class can't be statically pre-computed. */
  colorHex: string;
  duration: string;
  description: string;
  /** workType label: 'Coding', 'Meeting', etc. */
  workType?: string;
  isMeeting: boolean;
  /** Epoch ms. Used for sorting + rendering the time label. */
  startedAt: number;
  endedAt: number;
  /** Pre-formatted local clock label for the left rail (e.g. "9:00"). */
  startLabel: string;
}

/** Overtime banner data. `overTimeMs` is 0 when the day is under the
 *  threshold; the renderer hides the banner in that case. */
export interface OvertimeInfo {
  thresholdMs: number;
  workedMs: number;
  overMs: number;
  /** True when workedMs > thresholdMs. */
  isOver: boolean;
  /** Human-formatted display strings, pre-baked so renderers don't repeat formatHM. */
  thresholdLabel: string;
  workedLabel: string;
  overLabel: string;
}

/** Per-project rollup. Project is the major reporting dimension —
 *  every report screen surfaces this so the user can see time,
 *  outcomes, and unrealized effort grouped by client/initiative.
 *  Workstreams without a project land in an 'Unassigned' bucket. */
export interface ProjectBreakdown {
  /** Display name. 'Unassigned' for workstreams missing a project. */
  projectName: string;
  /** True when this is the synthetic 'Unassigned' bucket. */
  isUnassigned: boolean;
  totalMs: number;
  focusMs: number;
  meetingMs: number;
  /** % of the included total time. Rounded. */
  pct: number;
  workstreamCount: number;
  completedCount: number;
  blockedCount: number;
  followUpCount: number;
  unrealizedEffortCount: number;
  /** Names of the workstreams contributing to this project, in time order. */
  workstreamNames: string[];
  /** Tailwind bar class snapshotted from the first workstream — used so
   *  the project row in the UI carries an accent without re-deriving
   *  from the Project entity (which may have been deleted). */
  barClass: string;
  colorHex: string;
}

/** Meeting-specific rollup. Meetings are a first-class reporting
 *  dimension (alongside projects and workstreams) — the user wants
 *  to know how the day split between focus time and meetings, what
 *  share of meetings were planned vs impromptu, and which audiences
 *  drove the time. Present even when meetingCount === 0 so the
 *  renderer can hide the block with a single check. */
export interface MeetingBreakdown {
  meetingCount: number;
  meetingMs: number;
  /** % of included tracked time that was spent in meetings. Rounded. */
  meetingPct: number;
  /** Focus vs meeting ratio string, pre-baked. '—' when focusMs is 0. */
  focusToMeetingRatio: string;
  /** Planned vs impromptu split. Uncategorized meetings land in neither
   *  bucket so the two counts don't have to sum to meetingCount. */
  plannedCount: number;
  plannedMs: number;
  impromptuCount: number;
  impromptuMs: number;
  /** One row per audience category we saw. Sorted by totalMs desc. */
  byAudience: Array<{
    audience: MeetingAudience;
    label: string;
    count: number;
    totalMs: number;
    /** % of the meeting total (not the overall tracked total). */
    pct: number;
  }>;
  /** Top meetings by time, already time-formatted, for the report list. */
  topMeetings: Array<{
    panelId: string;
    name: string;
    barClass: string;
    colorHex: string;
    detail: string;
    time: string;
    meetingType?: MeetingType;
    audience?: MeetingAudience;
  }>;
}

// ---------- Per-report-kind outputs ----------

export interface DailySummaryData {
  title: string;
  dateLabel: string;
  kpis: KPI[];
  legend: LegendEntry[];
  timeline: TimelineEntry[];
  /** Per-project rollup, sorted by totalMs desc. */
  byProject: ProjectBreakdown[];
  /** Meeting-specific rollup — planned vs impromptu, audience mix,
   *  top meetings by time. */
  meetings: MeetingBreakdown;
  /** Paragraphs for the "AI Summary" block. Deterministic today. */
  narrative: string[];
  completed: string[];
  followUps: string[];
  blockers: string[];
  /** Copy of external digests that were included, for rendering. */
  includedExternalDigests: ExternalDigest[];
  /** Overtime banner data — set even when not over, so the renderer can
   *  decide whether to show it. */
  overtime: OvertimeInfo;
}

export interface PerformanceReviewData {
  title: string;
  rangeLabel: string;
  kpis: KPI[];
  allocation: LegendEntry[];
  /** Per-project rollup, sorted by totalMs desc. */
  byProject: ProjectBreakdown[];
  /** Meeting-specific rollup over the review window. Same shape as the
   *  daily breakdown, just summed across more days. */
  meetings: MeetingBreakdown;
  topAccomplishments: Array<{ name: string; detail: string; barClass: string; time: string }>;
  keyAchievements: Array<{ name: string; detail: string; barClass: string }>;
  growthAreas: Array<{ name: string; detail: string; barClass: string }>;
  narrative: string[];
  includedExternalDigests: ExternalDigest[];
}

// ============================================================
// Formatting helpers
// ============================================================

const pad2 = (n: number) => n.toString().padStart(2, '0');

export function formatHM(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}m` : `${h}h ${pad2(m)}m`;
}

export function formatHMSLoose(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} min` : `${h}h ${m}m`;
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`;
}

// ============================================================
// Input construction
// ============================================================

/** The arguments needed to build a SummaryInput. Callers assemble
 *  this from NavContext + PrepareSummary's local edits state. */
export interface BuildInputArgs {
  reportKind: ReportKind;
  audience: Audience;
  style: SummaryStyle;
  dateRange: { start: Date; end: Date; label: string };
  activePanelIds: string[];
  panelCatalog: Array<{
    id: string;
    name: string;
    barClass: string;
    colorHex: string;
  }>;
  panelAccum: Record<string, number>;
  panelDrafts: Record<
    string,
    {
      focusNote?: string;
      notes?: string;
      workType?: string;
      project?: string;
      tags?: string[];
      sessionState?: string;
      /** Session type. Omitted on legacy archived summaries — the
       *  generator treats `undefined` as 'work' to preserve behavior. */
      kind?: PanelKind;
      /** Meeting-only: planned vs impromptu. */
      meetingType?: MeetingType;
      /** Meeting-only: who the meeting is with. */
      audience?: MeetingAudience;
      /** Meeting-only: the purpose/topic string. */
      topic?: string;
    }
  >;
  panelEdits: Record<
    string,
    {
      included: boolean;
      outcome: PanelOutcome | null;
      followUp: FollowUpDetails;
      blocker: string;
      unrealizedEffort: boolean | null;
    }
  >;
  breakAccum: { break: number; lunch: number };
  /** Append-only run log. The generator filters runs to the report
   *  window so callers can pass the full app-level history. */
  runs?: RunSegment[];
  /** Optional overtime threshold override. Defaults to 8h. */
  overtimeThresholdMs?: number;
  includedSourceIds: SourceId[];
  externalDigests?: { claude?: ExternalDigest; browser?: ExternalDigest };
  mode?: GeneratorMode;
}

/** Default overtime threshold: anything past 8h tracked work flips the
 *  banner. Held as a module constant so callers can import it. */
export const DEFAULT_OVERTIME_THRESHOLD_MS = 8 * 60 * 60 * 1000;

export function buildSummaryInput(args: BuildInputArgs): SummaryInput {
  const catalogById = new Map(args.panelCatalog.map(p => [p.id, p]));

  // ---- Clip runs to the report window FIRST ----
  // The timeline and the per-panel totals both read from these same
  // clipped runs, so they can never disagree with each other.
  const windowStart = args.dateRange.start.getTime();
  const windowEnd = args.dateRange.end.getTime();
  const filteredRuns: RunSegment[] = (args.runs ?? [])
    .filter(r => r.endedAt > windowStart && r.startedAt < windowEnd)
    .map(r => ({
      panelId: r.panelId,
      startedAt: Math.max(r.startedAt, windowStart),
      endedAt: Math.min(r.endedAt, windowEnd),
    }))
    .sort((a, b) => a.startedAt - b.startedAt);

  // ---- Build a fresh per-panel accumulator from the filtered runs ----
  // We deliberately do NOT use `args.panelAccum` as the source of truth:
  //   1. Stale active-timer problem — TaskPanelsApp memoizes panelAccum
  //      against [runs, activeTimer]. When a timer starts, the memo body
  //      evaluates `Date.now() - activeTimer.startedAt ≈ 0` and caches
  //      that number. It does NOT refresh on its own, so the currently
  //      running panel's contribution sits at ~0 until the timer is
  //      banked. Callers like PrepareSummaryScreen already splice a
  //      synthetic active run into `args.runs`, so walking those runs
  //      gives us fresh data.
  //   2. Unclipped — panelAccum sums every run ever, regardless of
  //      date. Re-deriving from filteredRuns respects the report window
  //      automatically, so a daily report never counts yesterday's
  //      minutes.
  // If the caller didn't pass any runs (unusual, but possible), fall
  // back to panelAccum so we at least have something to show.
  const hasRuns = (args.runs ?? []).length > 0;
  const accumFromRuns: Record<string, number> = {};
  for (const r of filteredRuns) {
    accumFromRuns[r.panelId] = (accumFromRuns[r.panelId] ?? 0) + (r.endedAt - r.startedAt);
  }

  const workstreams: WorkstreamEntry[] = args.activePanelIds
    .map(id => {
      const meta = catalogById.get(id);
      if (!meta) return null;
      const draft = args.panelDrafts[id] ?? {};
      const edits = args.panelEdits[id] ?? {
        included: true,
        outcome: null,
        followUp: { waitingOn: '', passedOffTo: '', nextStep: '' },
        blocker: '',
        unrealizedEffort: null,
      };
      const trackedMs = hasRuns
        ? (accumFromRuns[id] ?? 0)
        : (args.panelAccum[id] ?? 0);
      const kind: PanelKind = draft.kind ?? 'work';
      // Back-compat: the legacy 'Meeting' work-type chip used to be the
      // only signal. Honor it so summaries generated before the meeting
      // refactor still register meetings correctly, but prefer the new
      // Panel-kind field when present.
      const isMeeting = kind === 'meeting' || draft.workType === 'Meeting';
      const entry: WorkstreamEntry = {
        panelId: id,
        name: meta.name,
        barClass: meta.barClass,
        colorHex: meta.colorHex,
        project: draft.project,
        workType: draft.workType,
        focusNote: draft.focusNote,
        notes: draft.notes,
        tags: draft.tags ?? [],
        sessionState: draft.sessionState,
        trackedMs,
        kind,
        isMeeting,
        meetingType: draft.meetingType,
        audience: draft.audience,
        topic: draft.topic,
        included: edits.included,
        outcome: edits.outcome,
        followUp: edits.followUp,
        blocker: edits.blocker,
        unrealizedEffort: edits.unrealizedEffort,
      };
      return entry;
    })
    .filter((x): x is WorkstreamEntry => x !== null);

  const totalTrackedMs = workstreams.reduce((sum, w) => sum + w.trackedMs, 0);
  const meetingMs = workstreams
    .filter(w => w.isMeeting)
    .reduce((sum, w) => sum + w.trackedMs, 0);
  const focusMs = totalTrackedMs - meetingMs;
  const breakMs = args.breakAccum.break + args.breakAccum.lunch;

  const taskpanels: TaskPanelsSource = {
    kind: 'taskpanels',
    date: args.dateRange.start.toISOString(),
    totalTrackedMs,
    focusMs,
    meetingMs,
    breakMs,
    workstreams,
    runs: filteredRuns,
    overtimeThresholdMs: args.overtimeThresholdMs ?? DEFAULT_OVERTIME_THRESHOLD_MS,
  };

  return {
    reportKind: args.reportKind,
    audience: args.audience,
    style: args.style,
    dateRange: {
      start: args.dateRange.start.toISOString(),
      end: args.dateRange.end.toISOString(),
      label: args.dateRange.label,
    },
    sources: {
      taskpanels,
      claude: args.externalDigests?.claude,
      browser: args.externalDigests?.browser,
    },
    includedSourceIds: args.includedSourceIds,
    mode: args.mode ?? 'deterministic',
  };
}

// ============================================================
// Deterministic narrative helpers
// ============================================================

/** How the narrative opens — tuned by audience so the same facts
 *  read differently to a manager vs a client vs the user themself. */
function openingClause(audience: Audience, hasFocus: boolean): string {
  if (!hasFocus) {
    switch (audience) {
      case 'manager': return 'No tracked focus time in this window.';
      case 'team':    return 'No tracked focus time in this window.';
      case 'client':  return 'No billable focus time was logged during this window.';
      case 'personal': return 'No focus time logged.';
    }
  }
  switch (audience) {
    case 'manager':  return 'Here is a summary of the work I tracked';
    case 'team':     return 'Here is what I worked on';
    case 'client':   return 'Here is a summary of the work completed on your behalf';
    case 'personal': return 'Here is what you tracked';
  }
}

// ============================================================
// Project breakdown — shared by every generator
// ============================================================

/** Group included workstreams by their `project` snapshot string and
 *  produce one `ProjectBreakdown` per bucket. Workstreams missing a
 *  project land in a single 'Unassigned' bucket so the report still
 *  accounts for every minute. Sorted by totalMs desc, with Unassigned
 *  pinned to the bottom regardless of size. */
function computeProjectBreakdowns(
  included: WorkstreamEntry[],
  totalMs: number,
): ProjectBreakdown[] {
  if (included.length === 0) return [];

  const UNASSIGNED = 'Unassigned';
  const buckets = new Map<string, WorkstreamEntry[]>();
  for (const w of included) {
    const key = w.project?.trim() || UNASSIGNED;
    const list = buckets.get(key);
    if (list) list.push(w);
    else buckets.set(key, [w]);
  }

  const breakdowns: ProjectBreakdown[] = [];
  for (const [name, ws] of buckets) {
    const projTotal = ws.reduce((s, w) => s + w.trackedMs, 0);
    const meeting = ws.filter(w => w.isMeeting).reduce((s, w) => s + w.trackedMs, 0);
    const focus = projTotal - meeting;
    // Order workstreams within a project by time spent so the most
    // significant work appears first when the row is expanded.
    const ordered = ws.slice().sort((a, b) => b.trackedMs - a.trackedMs);
    breakdowns.push({
      projectName: name,
      isUnassigned: name === UNASSIGNED,
      totalMs: projTotal,
      focusMs: focus,
      meetingMs: meeting,
      pct: totalMs > 0 ? Math.round((projTotal / totalMs) * 100) : 0,
      workstreamCount: ws.length,
      completedCount: ws.filter(w => w.outcome === 'completed').length,
      blockedCount: ws.filter(w => w.outcome === 'blocked').length,
      followUpCount: ws.filter(w => w.outcome === 'follow-up').length,
      unrealizedEffortCount: ws.filter(w => w.unrealizedEffort === true).length,
      workstreamNames: ordered.map(w => w.name),
      barClass: ordered[0]?.barClass ?? 'bg-slate-400',
      colorHex: ordered[0]?.colorHex ?? '#94a3b8',
    });
  }

  // Sort by total time desc, but always pin the synthetic 'Unassigned'
  // bucket to the bottom — it represents missing data, not a project.
  breakdowns.sort((a, b) => {
    if (a.isUnassigned && !b.isUnassigned) return 1;
    if (!a.isUnassigned && b.isUnassigned) return -1;
    return b.totalMs - a.totalMs;
  });
  return breakdowns;
}

// ============================================================
// Meeting breakdown — shared by every generator
// ============================================================

const AUDIENCE_LABELS: Record<MeetingAudience, string> = {
  internal: 'Internal',
  client: 'Client',
  leadership: 'Leadership',
  vendor: 'Vendor / Partner',
};

/** Roll meeting workstreams up into a single MeetingBreakdown block.
 *  Meetings are a first-class reporting dimension — even when a user
 *  has zero meeting time, the renderer can check `meetingCount === 0`
 *  and short-circuit. Counts are per-session (one meeting panel =
 *  one session) rather than per-run, so a meeting that got paused
 *  and resumed still counts once. */
function computeMeetingBreakdown(
  included: WorkstreamEntry[],
  totalMs: number,
): MeetingBreakdown {
  const meetings = included.filter(w => w.isMeeting);
  const meetingMs = meetings.reduce((sum, w) => sum + w.trackedMs, 0);
  const focusMs = included.filter(w => !w.isMeeting).reduce((sum, w) => sum + w.trackedMs, 0);

  const planned = meetings.filter(w => w.meetingType === 'planned');
  const impromptu = meetings.filter(w => w.meetingType === 'impromptu');

  // Audience rollup — only surface buckets that actually have data.
  const audienceMap = new Map<MeetingAudience, { count: number; totalMs: number }>();
  for (const w of meetings) {
    if (!w.audience) continue;
    const entry = audienceMap.get(w.audience);
    if (entry) {
      entry.count += 1;
      entry.totalMs += w.trackedMs;
    } else {
      audienceMap.set(w.audience, { count: 1, totalMs: w.trackedMs });
    }
  }
  const byAudience = Array.from(audienceMap.entries())
    .map(([audience, v]) => ({
      audience,
      label: AUDIENCE_LABELS[audience],
      count: v.count,
      totalMs: v.totalMs,
      pct: meetingMs > 0 ? Math.round((v.totalMs / meetingMs) * 100) : 0,
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  // Top meetings by time spent, limited so the UI block stays compact.
  const topMeetings = meetings
    .slice()
    .sort((a, b) => b.trackedMs - a.trackedMs)
    .slice(0, 5)
    .map(w => ({
      panelId: w.panelId,
      name: w.name,
      barClass: w.barClass,
      colorHex: w.colorHex,
      detail:
        w.topic?.trim() ||
        w.focusNote?.trim() ||
        meetingDescriptorFor(w) ||
        w.project ||
        '—',
      time: formatHM(w.trackedMs),
      meetingType: w.meetingType,
      audience: w.audience,
    }));

  const ratio =
    focusMs > 0 && meetingMs > 0
      ? `${(focusMs / meetingMs).toFixed(1)}:1`
      : '—';

  return {
    meetingCount: meetings.length,
    meetingMs,
    meetingPct: totalMs > 0 ? Math.round((meetingMs / totalMs) * 100) : 0,
    focusToMeetingRatio: ratio,
    plannedCount: planned.length,
    plannedMs: planned.reduce((sum, w) => sum + w.trackedMs, 0),
    impromptuCount: impromptu.length,
    impromptuMs: impromptu.reduce((sum, w) => sum + w.trackedMs, 0),
    byAudience,
    topMeetings,
  };
}

// ============================================================
// Generator: Daily Summary
// ============================================================

export function generateDailySummary(input: SummaryInput): DailySummaryData {
  const { audience, style, includedSourceIds } = input;
  const taskpanels = input.sources.taskpanels;
  const included = taskpanels.workstreams.filter(w => w.included);
  const totalMs = included.reduce((sum, w) => sum + w.trackedMs, 0);
  const focusMs = included.filter(w => !w.isMeeting).reduce((sum, w) => sum + w.trackedMs, 0);
  const meetingMs = included.filter(w => w.isMeeting).reduce((sum, w) => sum + w.trackedMs, 0);

  // ---- KPIs ----
  const completedCount = included.filter(w => w.outcome === 'completed').length;
  const blockedCount = included.filter(w => w.outcome === 'blocked').length;
  const followUpCount = included.filter(w => w.outcome === 'follow-up').length;

  // Compute overtime up here so the Tracked KPI can advertise it inline.
  const overtimePreview = computeOvertime(totalMs, taskpanels.overtimeThresholdMs);

  const kpis: KPI[] = [
    {
      label: 'Tracked',
      value: formatHM(totalMs),
      sub: overtimePreview.isOver
        ? `+${overtimePreview.overLabel} overtime`
        : pluralize(included.length, 'panel'),
    },
    { label: 'Focus',     value: formatHM(focusMs),    sub: 'non-meeting work' },
    { label: 'Meetings',  value: formatHM(meetingMs),  sub: pluralize(included.filter(w => w.isMeeting).length, 'session') },
    { label: 'Completed', value: String(completedCount), sub: blockedCount > 0 ? `${blockedCount} blocked` : undefined },
  ];

  // ---- Legend (percentages) ----
  const legend: LegendEntry[] = included
    .map(w => ({
      panelId: w.panelId,
      name: w.name,
      shortName: w.name.split(' ')[0],
      time: formatHM(w.trackedMs),
      colorHex: w.colorHex,
      barClass: w.barClass,
      pct: totalMs > 0 ? Math.round((w.trackedMs / totalMs) * 100) : 0,
      isMeeting: w.isMeeting,
    }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Timeline (real time-of-day, walks runs) ----
  //
  // Each run becomes one row. Adjacent runs of the same panel are merged
  // so a session that survived a single tab-switch doesn't fracture into
  // dozens of micro-rows. Break/lunch sentinels render as pause rows with
  // a clock icon.
  const includedById = new Map(included.map(w => [w.panelId, w]));
  const timeline = buildTimelineFromRuns(taskpanels.runs, includedById);

  // Reuse the overtime preview we already computed for the KPI sub-label.
  const overtime = overtimePreview;

  // ---- Classification buckets ----
  const completed = included
    .filter(w => w.outcome === 'completed')
    .map(w => w.focusNote?.trim() ? `${w.name} — ${w.focusNote.trim()}` : w.name);

  const followUps = included
    .filter(w => w.outcome === 'follow-up')
    .map(w => {
      const bits = [w.followUp.waitingOn, w.followUp.nextStep].filter(s => s?.trim());
      return bits.length > 0 ? `${w.name}: ${bits.join(' — ')}` : w.name;
    });

  const blockers = included
    .filter(w => w.outcome === 'blocked')
    .map(w => (w.blocker.trim() ? `${w.name}: ${w.blocker.trim()}` : `${w.name} (no detail captured)`));

  // Compute the meeting breakdown up-front so both the narrative and
  // the structured `meetings` block pull from the same numbers.
  const meetings = computeMeetingBreakdown(included, totalMs);

  // ---- Narrative ----
  const opening = openingClause(audience, focusMs > 0);
  const headline =
    totalMs === 0
      ? opening
      : `${opening}: **${formatHM(totalMs)}** across ${pluralize(included.length, 'workstream')}` +
        (meetingMs > 0
          ? ` — ${formatHM(focusMs)} focus and ${formatHM(meetingMs)} in meetings.`
          : '.');

  const narrative: string[] = [];
  narrative.push(headline);

  if (style !== 'concise') {
    if (completed.length > 0) {
      narrative.push(`Completed: ${joinList(completed)}.`);
    }
    if (followUps.length > 0) {
      narrative.push(`Follow-up needed on ${joinList(followUps)}.`);
    }
    if (blockers.length > 0) {
      narrative.push(`Blocked on ${joinList(blockers)}.`);
    }
  }

  if (style === 'detailed') {
    // Meeting-specific sentence: planned vs impromptu + audience mix.
    // Only emits when there's actually meeting time to describe so
    // a meeting-free day doesn't gain a dead line.
    if (meetings.meetingCount > 0) {
      const bits: string[] = [];
      if (meetings.plannedCount > 0 || meetings.impromptuCount > 0) {
        const halves: string[] = [];
        if (meetings.plannedCount > 0) {
          halves.push(`${pluralize(meetings.plannedCount, 'planned meeting')} (${formatHM(meetings.plannedMs)})`);
        }
        if (meetings.impromptuCount > 0) {
          halves.push(`${pluralize(meetings.impromptuCount, 'impromptu meeting')} (${formatHM(meetings.impromptuMs)})`);
        }
        bits.push(halves.join(' and '));
      }
      if (meetings.byAudience.length > 0) {
        const top = meetings.byAudience[0];
        bits.push(`most ${top.label.toLowerCase()}-facing (${top.pct}%)`);
      }
      if (bits.length > 0) {
        narrative.push(`Meetings: ${bits.join('; ')}.`);
      }
    }
    const abandoned = included.filter(w => w.outcome === 'abandoned');
    if (abandoned.length > 0) {
      const effort = abandoned.filter(w => w.unrealizedEffort === true).length;
      narrative.push(
        `Abandoned ${pluralize(abandoned.length, 'workstream')}` +
          (effort > 0 ? ` (${effort} logged as unrealized effort).` : '.'),
      );
    }
    if (input.sources.claude && includedSourceIds.includes('claude')) {
      narrative.push(`Claude Work digest: ${input.sources.claude.summary ?? 'included.'}`);
    }
    if (input.sources.browser && includedSourceIds.includes('browser')) {
      narrative.push(`Browser AI activity: ${input.sources.browser.summary ?? 'included.'}`);
    }
  }

  // ---- Included external digests ----
  const includedExternalDigests: ExternalDigest[] = [];
  if (input.sources.claude && includedSourceIds.includes('claude')) includedExternalDigests.push(input.sources.claude);
  if (input.sources.browser && includedSourceIds.includes('browser')) includedExternalDigests.push(input.sources.browser);

  // ---- Title / date ----
  const dateLabel = new Date(input.dateRange.start).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const byProject = computeProjectBreakdowns(included, totalMs);

  return {
    title: 'Daily Work Summary',
    dateLabel,
    kpis,
    legend,
    timeline,
    byProject,
    meetings,
    narrative,
    completed,
    followUps,
    blockers,
    includedExternalDigests,
    overtime,
  };
}

// ============================================================
// Timeline + overtime helpers (used by Daily Summary)
// ============================================================

const BREAK_SENTINEL = '__break__';
const LUNCH_SENTINEL = '__lunch__';
const IDLE_SENTINEL = '__idle__';

/** "9:00", "11:45", "1:55" — local clock label with no leading zero on hours. */
function formatClockLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m.toString().padStart(2, '0')}`;
}

/** Walk runs in order, merging adjacent runs of the same panel into one
 *  row. The `included` map filters out workstreams the user de-selected
 *  on Prepare Summary; their runs disappear from the timeline so the
 *  totals match what the rest of the report shows. */
function buildTimelineFromRuns(
  runs: RunSegment[],
  included: Map<string, WorkstreamEntry>,
): TimelineEntry[] {
  if (runs.length === 0) return [];

  // 1. Filter: drop idle runs and dropped workstreams.
  const visibleRuns = runs.filter(r => {
    if (r.panelId === IDLE_SENTINEL) return false;
    if (r.panelId === BREAK_SENTINEL || r.panelId === LUNCH_SENTINEL) return true;
    return included.has(r.panelId);
  });
  if (visibleRuns.length === 0) return [];

  // 2. Merge adjacent same-panel runs (stitch over short gaps too —
  //    a 30s tab-switch shouldn't split a session in the timeline).
  const STITCH_GAP_MS = 60 * 1000;
  type Bucket = { panelId: string; startedAt: number; endedAt: number };
  const merged: Bucket[] = [];
  for (const r of visibleRuns) {
    const last = merged[merged.length - 1];
    if (last && last.panelId === r.panelId && r.startedAt - last.endedAt <= STITCH_GAP_MS) {
      last.endedAt = Math.max(last.endedAt, r.endedAt);
    } else {
      merged.push({ panelId: r.panelId, startedAt: r.startedAt, endedAt: r.endedAt });
    }
  }

  // 3. Convert to TimelineEntry. Break/lunch get fixed labels and a
  //    slate accent so they read as pauses in the timeline rail.
  return merged.map((b, i): TimelineEntry => {
    const duration = b.endedAt - b.startedAt;
    if (b.panelId === BREAK_SENTINEL || b.panelId === LUNCH_SENTINEL) {
      const isLunch = b.panelId === LUNCH_SENTINEL;
      return {
        id: `tl_${i}_${b.startedAt}`,
        panelId: b.panelId,
        kind: isLunch ? 'lunch' : 'break',
        name: isLunch ? 'Lunch' : 'Break',
        barClass: 'bg-amber-300',
        colorHex: '#fcd34d',
        duration: formatHM(duration),
        description: '',
        isMeeting: false,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        startLabel: formatClockLabel(b.startedAt),
      };
    }
    const w = included.get(b.panelId);
    if (!w) {
      // Defensive — shouldn't hit because of the filter above, but keeps
      // the renderer from crashing on an unmapped id.
      return {
        id: `tl_${i}_${b.startedAt}`,
        panelId: b.panelId,
        kind: 'work',
        name: 'Untitled',
        barClass: 'bg-slate-400',
        colorHex: '#94a3b8',
        duration: formatHM(duration),
        description: '',
        isMeeting: false,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        startLabel: formatClockLabel(b.startedAt),
      };
    }
    // Meetings lead with their topic field; work panels lead with their
    // focus note. This way the timeline rail reads naturally whether the
    // row is "Client Call — Q2 budget review" or "Website Refresh — fix
    // hero CTA bug".
    const description = w.isMeeting
      ? (w.topic?.trim() ||
          w.focusNote?.trim() ||
          w.notes?.trim() ||
          [w.project, meetingDescriptorFor(w)].filter(Boolean).join(' → ') ||
          '')
      : (w.focusNote?.trim() ||
          w.notes?.trim() ||
          [w.project, w.workType].filter(Boolean).join(' → ') ||
          '');
    return {
      id: `tl_${i}_${b.startedAt}`,
      panelId: b.panelId,
      kind: 'work',
      name: w.name,
      barClass: w.barClass,
      colorHex: w.colorHex,
      duration: formatHM(duration),
      description,
      workType: w.workType,
      isMeeting: w.isMeeting,
      startedAt: b.startedAt,
      endedAt: b.endedAt,
      startLabel: formatClockLabel(b.startedAt),
    };
  });
}

/** Human-readable meeting descriptor built from type + audience, used as
 *  a last-resort description fallback for meeting rows. "Planned · Client"
 *  communicates more than an empty cell when the user hasn't written a topic. */
function meetingDescriptorFor(w: WorkstreamEntry): string {
  const bits: string[] = [];
  if (w.meetingType === 'planned') bits.push('Planned');
  else if (w.meetingType === 'impromptu') bits.push('Impromptu');
  if (w.audience === 'internal') bits.push('Internal');
  else if (w.audience === 'client') bits.push('Client');
  else if (w.audience === 'leadership') bits.push('Leadership');
  else if (w.audience === 'vendor') bits.push('Vendor / Partner');
  return bits.join(' · ');
}

function computeOvertime(workedMs: number, thresholdMs: number): OvertimeInfo {
  const safeThreshold = thresholdMs > 0 ? thresholdMs : DEFAULT_OVERTIME_THRESHOLD_MS;
  const overMs = Math.max(0, workedMs - safeThreshold);
  return {
    thresholdMs: safeThreshold,
    workedMs,
    overMs,
    isOver: overMs > 0,
    thresholdLabel: formatHM(safeThreshold),
    workedLabel: formatHM(workedMs),
    overLabel: formatHM(overMs),
  };
}

// ============================================================
// Generator: Performance Review
// ============================================================

export function generatePerformanceReview(input: SummaryInput): PerformanceReviewData {
  const { audience, style, dateRange, includedSourceIds } = input;
  const taskpanels = input.sources.taskpanels;
  const included = taskpanels.workstreams.filter(w => w.included);
  const totalMs = included.reduce((sum, w) => sum + w.trackedMs, 0);
  const focusMs = included.filter(w => !w.isMeeting).reduce((sum, w) => sum + w.trackedMs, 0);
  const meetingMs = included.filter(w => w.isMeeting).reduce((sum, w) => sum + w.trackedMs, 0);

  // Range day count for avg/day KPI.
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const dayMs = 24 * 60 * 60 * 1000;
  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
  const avgPerDayMs = Math.round(totalMs / rangeDays);

  const completed = included.filter(w => w.outcome === 'completed');
  const inProgress = included.filter(w => w.outcome === 'in-progress');
  const blocked = included.filter(w => w.outcome === 'blocked');
  const followUp = included.filter(w => w.outcome === 'follow-up');
  const abandoned = included.filter(w => w.outcome === 'abandoned');

  const kpis: KPI[] = [
    { label: 'Panels Completed', value: String(completed.length), sub: `${included.length} tracked` },
    { label: 'Tracked Time',     value: formatHM(totalMs),        sub: `${formatHM(focusMs)} focus` },
    { label: 'Meetings',         value: formatHM(meetingMs),      sub: pluralize(included.filter(w => w.isMeeting).length, 'session') },
    { label: 'Avg / Day',        value: formatHM(avgPerDayMs),    sub: `over ${pluralize(rangeDays, 'day')}` },
  ];

  // ---- Allocation ----
  const allocation: LegendEntry[] = included
    .map(w => ({
      panelId: w.panelId,
      name: w.name,
      shortName: w.name.split(' ')[0],
      time: formatHM(w.trackedMs),
      colorHex: w.colorHex,
      barClass: w.barClass,
      pct: totalMs > 0 ? Math.round((w.trackedMs / totalMs) * 100) : 0,
      isMeeting: w.isMeeting,
    }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Top 5 accomplishments (completed, sorted by time) ----
  const topAccomplishments = completed
    .slice()
    .sort((a, b) => b.trackedMs - a.trackedMs)
    .slice(0, 5)
    .map(w => ({
      name: w.name,
      detail: w.focusNote?.trim() || w.notes?.trim() || w.project || '—',
      barClass: w.barClass,
      time: formatHM(w.trackedMs),
    }));

  // ---- Key achievements — completed panels with narrative detail ----
  const keyAchievements = completed
    .filter(w => (w.focusNote?.trim() || w.notes?.trim()))
    .map(w => ({
      name: w.name,
      detail: w.focusNote?.trim() || w.notes?.trim() || '',
      barClass: w.barClass,
    }));

  // ---- Growth areas — blockers + follow-ups + abandoned ----
  const growthAreas: Array<{ name: string; detail: string; barClass: string }> = [];
  for (const w of blocked) {
    growthAreas.push({
      name: w.name,
      detail: w.blocker.trim() || 'Blocker recorded without detail.',
      barClass: w.barClass,
    });
  }
  for (const w of followUp) {
    const bits = [w.followUp.waitingOn, w.followUp.nextStep].filter(s => s?.trim());
    growthAreas.push({
      name: w.name,
      detail: bits.length > 0 ? bits.join(' — ') : 'Follow-up pending.',
      barClass: w.barClass,
    });
  }
  for (const w of abandoned) {
    growthAreas.push({
      name: w.name,
      detail:
        w.unrealizedEffort === true
          ? 'Logged as unrealized effort.'
          : 'Abandoned — deprioritized.',
      barClass: w.barClass,
    });
  }

  // Compute the meeting breakdown up-front so the narrative can reach
  // into planned/impromptu counts without re-walking the workstreams.
  const meetings = computeMeetingBreakdown(included, totalMs);

  // ---- Narrative ----
  const opening = openingClause(audience, focusMs > 0);
  const rangeLabel = dateRange.label;
  const narrative: string[] = [];

  narrative.push(
    totalMs === 0
      ? `${opening} (${rangeLabel}).`
      : `${opening} for ${rangeLabel}: **${formatHM(totalMs)}** across ${pluralize(included.length, 'workstream')}, ` +
        `averaging ${formatHM(avgPerDayMs)} per day.`,
  );

  if (style !== 'concise' && completed.length > 0) {
    narrative.push(
      `${pluralize(completed.length, 'workstream')} reached completion` +
        (inProgress.length > 0 ? `, with ${pluralize(inProgress.length, 'other')} still in progress.` : '.'),
    );
  }

  if (style === 'detailed') {
    if (meetingMs > 0) {
      narrative.push(
        `Focus-to-meeting split: ${formatHM(focusMs)} focus / ${formatHM(meetingMs)} meetings` +
          (meetings.focusToMeetingRatio !== '—' ? ` (ratio ${meetings.focusToMeetingRatio}).` : '.'),
      );
      // Planned vs impromptu mix — surfaces whether the window was
      // dominated by scheduled meetings or walked-up interruptions.
      if (meetings.plannedCount > 0 || meetings.impromptuCount > 0) {
        const halves: string[] = [];
        if (meetings.plannedCount > 0) {
          halves.push(`${pluralize(meetings.plannedCount, 'planned meeting')} (${formatHM(meetings.plannedMs)})`);
        }
        if (meetings.impromptuCount > 0) {
          halves.push(`${pluralize(meetings.impromptuCount, 'impromptu meeting')} (${formatHM(meetings.impromptuMs)})`);
        }
        narrative.push(`Meeting mix: ${halves.join(' and ')}.`);
      }
      if (meetings.byAudience.length > 0) {
        const parts = meetings.byAudience.map(a => `${a.label} (${a.pct}%)`);
        narrative.push(`Audience breakdown: ${joinList(parts)}.`);
      }
    }
    if (blocked.length > 0 || followUp.length > 0) {
      const bits: string[] = [];
      if (blocked.length > 0) bits.push(`${pluralize(blocked.length, 'blocker')}`);
      if (followUp.length > 0) bits.push(`${pluralize(followUp.length, 'follow-up')}`);
      narrative.push(`Outstanding items: ${bits.join(' and ')}.`);
    }
    if (input.sources.claude && includedSourceIds.includes('claude')) {
      narrative.push(`Claude Work digest: ${input.sources.claude.summary ?? 'included.'}`);
    }
    if (input.sources.browser && includedSourceIds.includes('browser')) {
      narrative.push(`Browser AI activity: ${input.sources.browser.summary ?? 'included.'}`);
    }
  }

  // ---- Included external digests ----
  const includedExternalDigests: ExternalDigest[] = [];
  if (input.sources.claude && includedSourceIds.includes('claude')) includedExternalDigests.push(input.sources.claude);
  if (input.sources.browser && includedSourceIds.includes('browser')) includedExternalDigests.push(input.sources.browser);

  const byProject = computeProjectBreakdowns(included, totalMs);

  return {
    title: `Performance Review — ${rangeLabel}`,
    rangeLabel,
    kpis,
    allocation,
    byProject,
    meetings,
    topAccomplishments,
    keyAchievements,
    growthAreas,
    narrative,
    includedExternalDigests,
  };
}
