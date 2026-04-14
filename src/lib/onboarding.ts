// ============================================================
// Onboarding — role-based starter packs + persistence
// ------------------------------------------------------------
// Deterministic first pass: each WorkRole maps to a curated set
// of starter panel types. AI-assisted recommendations can later
// replace or augment the static packs without touching the UI.
// ============================================================

import { makePanel, type MockPanel } from './panelCatalog';

// ---- Work Roles ----

export interface WorkRole {
  id: string;
  label: string;
  description: string;
  /** Icon hint — the OnboardingScreen renders the actual SVG. */
  icon: string;
}

export const WORK_ROLES: WorkRole[] = [
  { id: 'marketing',    label: 'Marketing / Content',       description: 'Campaigns, writing, social, SEO',   icon: 'megaphone' },
  { id: 'product',      label: 'Product / Strategy',        description: 'Roadmaps, discovery, planning',     icon: 'lightbulb' },
  { id: 'design',       label: 'Design / Creative',         description: 'UI/UX, branding, assets',           icon: 'palette' },
  { id: 'engineering',  label: 'Engineering / Technical',    description: 'Code, architecture, debugging',     icon: 'code' },
  { id: 'operations',   label: 'Operations / Admin',        description: 'Process, coordination, tracking',   icon: 'cog' },
  { id: 'client',       label: 'Client / Consulting',       description: 'Delivery, reviews, presentations',  icon: 'briefcase' },
  { id: 'general',      label: 'General Knowledge Work',    description: 'Research, writing, meetings',        icon: 'squares' },
];

// ---- Starter Panel Packs ----

export interface StarterPanel {
  name: string;
  colorId: string;
}

/**
 * Role → recommended starter panels. These are intentionally small
 * sets (5–7 panels) so the user isn't overwhelmed.
 *
 * Future: an AI layer could replace this static map with personalized
 * recommendations based on the user's org, title, or short text input.
 */
const STARTER_PACKS: Record<string, StarterPanel[]> = {
  marketing: [
    { name: 'Writing',        colorId: 'blue' },
    { name: 'Strategy',       colorId: 'purple' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Social Media',   colorId: 'rose' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Admin',          colorId: 'slate' },
  ],
  product: [
    { name: 'Strategy',       colorId: 'purple' },
    { name: 'Planning',       colorId: 'blue' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Writing',        colorId: 'orange' },
  ],
  design: [
    { name: 'Design',         colorId: 'blue' },
    { name: 'Revisions',      colorId: 'orange' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Admin',          colorId: 'slate' },
  ],
  engineering: [
    { name: 'Coding',         colorId: 'blue' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Debugging',      colorId: 'rose' },
    { name: 'Planning',       colorId: 'purple' },
    { name: 'Meetings',       colorId: 'amber' },
  ],
  operations: [
    { name: 'Coordination',   colorId: 'blue' },
    { name: 'Admin',          colorId: 'slate' },
    { name: 'Planning',       colorId: 'purple' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Writing',        colorId: 'orange' },
  ],
  client: [
    { name: 'Client Work',    colorId: 'blue' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Strategy',       colorId: 'purple' },
    { name: 'Revisions',      colorId: 'orange' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Admin',          colorId: 'slate' },
  ],
  general: [
    { name: 'Deep Work',      colorId: 'blue' },
    { name: 'Writing',        colorId: 'purple' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Admin',          colorId: 'slate' },
  ],
};

export function getStarterPanels(roleId: string): StarterPanel[] {
  return STARTER_PACKS[roleId] ?? STARTER_PACKS.general;
}

/** Convert a set of StarterPanels into full MockPanel catalog entries. */
export function buildCatalogFromStarters(starters: StarterPanel[]): MockPanel[] {
  return starters.map(s => makePanel({ name: s.name, colorId: s.colorId }));
}

// ---- Summary Audience ----

export type SummaryAudience = 'manager' | 'internal' | 'client' | 'personal';

export const AUDIENCE_OPTIONS: { id: SummaryAudience; label: string; description: string }[] = [
  { id: 'manager',  label: 'Manager',  description: 'Status updates for leadership' },
  { id: 'internal', label: 'Internal', description: 'Team stand-ups and hand-offs' },
  { id: 'client',   label: 'Client',   description: 'External progress reports' },
  { id: 'personal', label: 'Personal', description: 'Self-tracking and reflection' },
];

// ---- Persistence ----

const ONBOARDING_KEY = 'taskpanels.onboarding.v1';

export interface OnboardingResult {
  completedAt: number;
  roleId: string;
  audience: SummaryAudience;
}

export function loadOnboarding(): OnboardingResult | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingResult;
    if (!parsed || !parsed.completedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboarding(result: OnboardingResult): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(result));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function clearOnboarding(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}
