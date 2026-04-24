// ============================================================
// Onboarding Flow — 5-step lightweight setup
// Matches the TaskPanels design system: calm, premium, mobile-first.
//
// Steps:
//   1. Welcome
//   2. Work Type / Role
//   3. Recommended Starter Panels (editable)
//   4. Default Summary Audience (optional)
//   5. Ready — enter the app
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  WORK_ROLES,
  getStarterPanels,
  buildCatalogFromStarters,
  AUDIENCE_OPTIONS,
  saveOnboarding,
  type StarterPanel,
  type SummaryAudience,
  type WorkRole,
} from '../../lib/onboarding';
import { PANEL_COLOR_OPTIONS, saveCatalog, colorOptionFor } from '../../lib/panelCatalog';

type Step = 1 | 2 | 3 | 4 | 5;

/**
 * Logical onboarding stages. Team members skip ROLE because their
 * department already determined it — asking them again creates
 * confusion when their department (e.g. "Marketing") doesn't match
 * what they'd pick (e.g. "DevOps"). The role is still derived from
 * the department and used to seed starter panels.
 */
type Stage = 'welcome' | 'role' | 'panels' | 'audience' | 'ready';

interface OnboardingScreenProps {
  /** Called once the user completes onboarding. The caller receives both
   *  the raw ids (for routing / logic) and the human-readable labels so
   *  they can seed the user's profile without re-looking them up. */
  onComplete: (result: {
    roleId: string;
    audience: SummaryAudience;
    roleLabel: string;
    audienceLabel: string;
    name: string;
  }) => void;
  /** Optional. When present, the flow adapts for a user who just joined
   *  a team via invite: welcome step names the team + department, and
   *  the role is pre-selected from the department name (overridable). */
  teamContext?: {
    teamName: string;
    departmentName: string;
    /** Best-guess role id derived from the department name. Falls back
     *  to 'general' if no heuristic matches. */
    suggestedRoleId: string;
  };
  /** Prefill for the name field. When non-empty (e.g. from Google SSO or
   *  Stripe customer_details), we skip the name prompt on the welcome
   *  step. When empty (typical for OTP/invite users), the welcome step
   *  shows a required name input before "Get Started". */
  initialName?: string;
}

// ---- Shared Components ----

const Logo: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx="10" cy="10" r="5" fill="#3b82f6" />
    <circle cx="22" cy="10" r="5" fill="#f97316" />
    <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
    <circle cx="22" cy="22" r="5" fill="#10b981" />
  </svg>
);

const StepIndicator: React.FC<{ current: Step; total: number }> = ({ current, total }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }, (_, i) => {
      const step = i + 1;
      const isActive = step === current;
      const isDone = step < current;
      return (
        <div
          key={step}
          className={`h-1 rounded-full transition-all duration-300 ${
            isActive ? 'w-6 bg-slate-900' : isDone ? 'w-4 bg-slate-400' : 'w-4 bg-slate-200'
          }`}
        />
      );
    })}
  </div>
);

// ---- Role Icons ----

const RoleIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = 'w-5 h-5' }) => {
  const props = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.75 };
  switch (icon) {
    case 'megaphone':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
    case 'lightbulb':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
    case 'palette':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>;
    case 'code':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
    case 'cog':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'briefcase':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    case 'squares':
    default:
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" /><rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" /><rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
};

// ---- Main Component ----

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, teamContext, initialName = '' }) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedRole, setSelectedRole] = useState<string | null>(
    teamContext?.suggestedRoleId ?? null,
  );
  const [selectedPanels, setSelectedPanels] = useState<StarterPanel[]>(() => {
    // Seed panels from the suggested role so team-joiners see a
    // pre-filled pack on the Panels step (still editable).
    if (teamContext?.suggestedRoleId) {
      return getStarterPanels(teamContext.suggestedRoleId);
    }
    return [];
  });
  const [audience, setAudience] = useState<SummaryAudience>('manager');
  const [name, setName] = useState(initialName.trim());
  const needsName = !initialName.trim();
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Auto-populate panel suggestions when a role is selected.
  const selectRole = useCallback((roleId: string) => {
    setSelectedRole(roleId);
    setSelectedPanels(getStarterPanels(roleId));
  }, []);

  // Panel pill management.
  const togglePanel = useCallback((panel: StarterPanel) => {
    setSelectedPanels(prev => {
      const exists = prev.some(p => p.name === panel.name);
      return exists ? prev.filter(p => p.name !== panel.name) : [...prev, panel];
    });
  }, []);

  const addCustomPanel = useCallback(() => {
    const name = customName.trim();
    if (!name) return;
    // Pick a color not yet used, or cycle.
    const usedColors = new Set(selectedPanels.map(p => p.colorId));
    const available = PANEL_COLOR_OPTIONS.find(c => !usedColors.has(c.id));
    const colorId = available?.id ?? PANEL_COLOR_OPTIONS[selectedPanels.length % PANEL_COLOR_OPTIONS.length].id;
    setSelectedPanels(prev => [...prev, { name, colorId }]);
    setCustomName('');
    setShowCustomInput(false);
  }, [customName, selectedPanels]);

  // All starter panel options for the role (for the toggle UI).
  const allRolePanels = useMemo(
    () => (selectedRole ? getStarterPanels(selectedRole) : []),
    [selectedRole],
  );

  // Stage list drives step navigation. Team members skip 'role' —
  // their department already determined it via teamContext.suggestedRoleId.
  const stages: Stage[] = teamContext
    ? ['welcome', 'panels', 'audience', 'ready']
    : ['welcome', 'role', 'panels', 'audience', 'ready'];
  const totalSteps = stages.length;
  const currentStage: Stage = stages[step - 1] ?? 'welcome';

  const next = () => setStep(s => Math.min(totalSteps, s + 1) as Step);
  const back = () => setStep(s => Math.max(1, s - 1) as Step);

  const finish = useCallback(() => {
    const roleId = selectedRole ?? 'general';

    // Build and persist the catalog.
    const catalog = buildCatalogFromStarters(selectedPanels);
    saveCatalog(catalog);

    // Persist onboarding result.
    saveOnboarding({
      completedAt: Date.now(),
      roleId,
      audience,
    });

    // Look up human-readable labels so the parent can seed the user's
    // profile (role + defaultAudience) without re-importing the lookup
    // tables. Falls back gracefully if the id isn't found.
    const roleLabel =
      WORK_ROLES.find(r => r.id === roleId)?.label ?? 'General Knowledge Work';
    const audienceLabel =
      AUDIENCE_OPTIONS.find(o => o.id === audience)?.label ?? 'Manager';

    onComplete({ roleId, audience, roleLabel, audienceLabel, name: name.trim() });
  }, [selectedRole, selectedPanels, audience, onComplete, name]);

  // ---- Step Renderers ----

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 flex-1">
      <div className="mb-8">
        <Logo size={56} />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
        {teamContext
          ? `Welcome to ${teamContext.teamName}`
          : 'Welcome to TaskPanels'}
      </h1>
      {teamContext ? (
        <>
          <p className="text-sm md:text-base text-slate-600 max-w-sm mb-2 leading-relaxed">
            You've joined the <span className="font-semibold text-slate-900">{teamContext.departmentName}</span> department.
          </p>
          <p className="text-sm text-slate-500 max-w-sm mb-10 leading-relaxed">
            We've lined up starter panels based on your department — tweak them in the next step, or keep the defaults and start tracking.
          </p>
        </>
      ) : (
        <p className="text-sm md:text-base text-slate-500 max-w-sm mb-10 leading-relaxed">
          Track your work, generate summaries, and own your day.
          Let's get you set up in under a minute.
        </p>
      )}
      {needsName && (
        <div className="w-full max-w-xs mb-6 text-left">
          <label htmlFor="onboarding-name" className="block text-xs font-medium text-slate-600 mb-1.5">
            What should we call you?
          </label>
          <input
            id="onboarding-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
      )}
      <button
        onClick={next}
        disabled={needsName && !name.trim()}
        className="h-12 px-8 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Get Started
      </button>
    </div>
  );

  const renderRoleSelection = () => (
    <div className="flex flex-col flex-1 px-5 md:px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-1.5">
          What kind of work do you do?
        </h2>
        <p className="text-sm text-slate-400">
          We'll suggest starter panels based on your role
        </p>
      </div>
      <div className="flex-1 overflow-auto space-y-2 pb-4">
        {WORK_ROLES.map((role: WorkRole) => {
          const isSelected = selectedRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => selectRole(role.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-500'
                }`}>
                  <RoleIcon icon={role.icon} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {role.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {role.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="ml-auto shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button onClick={back} className="h-11 px-5 text-sm font-medium text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          Back
        </button>
        <button
          onClick={next}
          disabled={!selectedRole}
          className="flex-1 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderPanels = () => (
    <div className="flex flex-col flex-1 px-5 md:px-8 py-6">
      <div className="mb-5">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-1.5">
          Start with these panels
        </h2>
        <p className="text-sm text-slate-400">
          Toggle any off, or add your own — you can always change this later
        </p>
      </div>

      <div className="flex-1 overflow-auto pb-4">
        {/* Recommended pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {allRolePanels.map(panel => {
            const isSelected = selectedPanels.some(p => p.name === panel.name);
            const opt = colorOptionFor(panel.colorId);
            return (
              <button
                key={panel.name}
                onClick={() => togglePanel(panel)}
                className={`h-9 px-4 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                  isSelected
                    ? `${opt.bgClass} ${opt.borderClass} ${opt.timerColorClass}`
                    : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? opt.barClass : 'bg-slate-300'}`} />
                {panel.name}
              </button>
            );
          })}

          {/* Custom panels added by user */}
          {selectedPanels
            .filter(p => !allRolePanels.some(rp => rp.name === p.name))
            .map(panel => {
              const opt = colorOptionFor(panel.colorId);
              return (
                <button
                  key={panel.name}
                  onClick={() => togglePanel(panel)}
                  className={`h-9 px-4 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${opt.bgClass} ${opt.borderClass} ${opt.timerColorClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.barClass}`} />
                  {panel.name}
                  <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              );
            })}
        </div>

        {/* Custom add */}
        {showCustomInput ? (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomPanel()}
              placeholder="Panel name"
              autoFocus
              className="flex-1 h-10 px-4 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent placeholder:text-slate-300"
            />
            <button
              onClick={addCustomPanel}
              disabled={!customName.trim()}
              className="h-10 px-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30"
            >
              Add
            </button>
            <button
              onClick={() => { setShowCustomInput(false); setCustomName(''); }}
              className="h-10 w-10 flex items-center justify-center text-slate-400 rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="h-9 px-4 rounded-full text-sm font-medium border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
            </svg>
            Add custom panel
          </button>
        )}

        {/* Preview cards — a small preview of what the catalog will look like */}
        {selectedPanels.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Your starter catalog
            </p>
            {selectedPanels.map(panel => {
              const opt = colorOptionFor(panel.colorId);
              return (
                <div
                  key={panel.name}
                  className={`${opt.bgClass} rounded-xl border ${opt.borderClass} p-3.5 flex items-center gap-3`}
                >
                  <div className={`w-1.5 h-8 rounded-full ${opt.barClass}`} />
                  <span className="text-sm font-semibold text-slate-800">{panel.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button onClick={back} className="h-11 px-5 text-sm font-medium text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          Back
        </button>
        <button
          onClick={next}
          disabled={selectedPanels.length === 0}
          className="flex-1 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderAudience = () => (
    <div className="flex flex-col flex-1 px-5 md:px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-1.5">
          Who are your summaries for?
        </h2>
        <p className="text-sm text-slate-400">
          Sets your default audience — easy to change per report
        </p>
      </div>

      <div className="flex-1 overflow-auto space-y-2 pb-4">
        {AUDIENCE_OPTIONS.map(opt => {
          const isSelected = audience === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setAudience(opt.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {opt.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {opt.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="ml-auto shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button onClick={back} className="h-11 px-5 text-sm font-medium text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          Back
        </button>
        <button
          onClick={next}
          className="flex-1 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderReady = () => {
    const roleName = WORK_ROLES.find(r => r.id === selectedRole)?.label ?? 'your workflow';
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-12 flex-1">
        {/* Checkmark animation placeholder */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
          {teamContext ? `You're in, welcome to ${teamContext.teamName}` : "You're all set"}
        </h2>
        <p className="text-sm md:text-base text-slate-500 max-w-sm mb-2 leading-relaxed">
          {selectedPanels.length} panels ready for {roleName}.
          {teamContext && (
            <> Shared projects from <span className="font-semibold text-slate-700">{teamContext.departmentName}</span> are already available.</>
          )}
        </p>
        <p className="text-xs text-slate-400 mb-10">
          Tap <span className="font-semibold text-slate-600">Start Panel</span> on the home screen to begin tracking.
        </p>
        <button
          onClick={finish}
          className="h-12 px-8 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          Enter TaskPanels
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    );
  };

  // ---- Render ----

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-full max-w-md md:max-w-lg bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm min-h-screen md:min-h-0 md:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header with step indicator — not on welcome/ready */}
        {currentStage !== 'welcome' && currentStage !== 'ready' && (
          <div className="px-5 md:px-8 pt-5 pb-0 flex items-center justify-between">
            <Logo size={28} />
            <StepIndicator current={step} total={totalSteps} />
          </div>
        )}

        {currentStage === 'welcome' && renderWelcome()}
        {currentStage === 'role' && renderRoleSelection()}
        {currentStage === 'panels' && renderPanels()}
        {currentStage === 'audience' && renderAudience()}
        {currentStage === 'ready' && renderReady()}
      </div>
    </div>
  );
};
