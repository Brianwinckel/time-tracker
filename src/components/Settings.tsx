// ============================================================
// Settings screen — email template, tag management, preferences
// ============================================================

import React, { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isPushSupported, getPushPermission, subscribeToPush, unsubscribeFromPush } from '../utils/push';
import { TASK_COLORS } from '../utils/colors';
import { BillingSettings } from './billing/BillingSettings';
import type { TagCategory, TagOption } from '../types';
import * as storage from '../storage';

// ---- Tag List Editor sub-component ----

interface TagListEditorProps {
  category: TagCategory;
  title: string;
}

const CATEGORY_DESCRIPTIONS: Record<TagCategory, string> = {
  project: 'Projects represent what your work supports. Assign a project to each session for clearer reporting.',
  value_category: 'Value categories explain why your work matters. Use "Unrealized Effort" for work that was shelved or scrapped.',
  work_style: 'Work styles describe how the work was done.',
  output_type: 'Output types describe what the work produced.',
  session_status: 'Session statuses track the outcome of each work session.',
};

const TagListEditor: React.FC<TagListEditorProps> = ({ category, title }) => {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const options = state.tagOptions.filter(o => o.category === category);

  const handleAdd = () => {
    if (!newValue.trim() || !user?.id) return;
    if (options.some(o => o.value === newValue.trim())) return;

    const option: TagOption = {
      id: uuid(),
      userId: user.id,
      category,
      value: newValue.trim(),
      color: TASK_COLORS[options.length % TASK_COLORS.length],
      sortOrder: options.length,
      isDefault: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_TAG_OPTION', option });
    storage.saveTagOption(option);
    setNewValue('');
  };

  const handleRename = (opt: TagOption) => {
    if (!editValue.trim()) return;
    const updated = { ...opt, value: editValue.trim() };
    dispatch({ type: 'UPDATE_TAG_OPTION', option: updated });
    storage.saveTagOption(updated);
    setEditingId(null);
  };

  const handleDelete = (opt: TagOption) => {
    if (!confirm(`Archive "${opt.value}"? It will be hidden from selectors but existing data is preserved.`)) return;
    dispatch({ type: 'DELETE_TAG_OPTION', optionId: opt.id });
    storage.deleteTagOption(opt.id);
  };

  return (
    <div className="tag-list-editor">
      <p className="settings__info">{CATEGORY_DESCRIPTIONS[category]}</p>
      <div className="tag-list-editor__items">
        {options.map(opt => (
          <div key={opt.id} className="tag-list-editor__item">
            <span
              className="tag-list-editor__color"
              style={{ backgroundColor: opt.color }}
            />
            {editingId === opt.id ? (
              <>
                <input
                  type="text"
                  className="tag-list-editor__input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(opt);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
                <button className="btn btn--small btn--primary" onClick={() => handleRename(opt)}>Save</button>
                <button className="btn btn--small btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span className="tag-list-editor__value">{opt.value}</span>
                {opt.isDefault && <span className="tag-list-editor__default">default</span>}
                <button
                  className="btn btn--icon"
                  onClick={() => { setEditingId(opt.id); setEditValue(opt.value); }}
                  title="Rename"
                >&#9998;</button>
                <button
                  className="btn btn--icon btn--icon-danger"
                  onClick={() => handleDelete(opt)}
                  title="Archive"
                >&#10005;</button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="tag-list-editor__add">
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}...`}
          maxLength={40}
        />
        <button
          className="btn btn--small btn--primary"
          onClick={handleAdd}
          disabled={!newValue.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
};

// ---- Main Settings Component ----

export const Settings: React.FC = () => {
  const { state, dispatch } = useApp();
  const { signOut, user } = useAuth();
  const s = state.settings;
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    setPushEnabled(getPushPermission() === 'granted');
  }, []);

  const handlePushToggle = async () => {
    if (!user) return;
    setPushLoading(true);
    if (pushEnabled) {
      await unsubscribeFromPush(user.id);
      setPushEnabled(false);
    } else {
      const success = await subscribeToPush(user.id);
      setPushEnabled(success);
    }
    setPushLoading(false);
  };

  const update = (patch: Partial<typeof s>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
  };

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="settings__section">
        <h3>Subscription & Billing</h3>
        <BillingSettings />
      </section>

      <section className="settings__section">
        <h3>Email Template</h3>

        <label className="field">
          <span>Your Name</span>
          <input type="text" value={s.myName} onChange={e => update({ myName: e.target.value })} />
        </label>

        <label className="field">
          <span>Boss / Recipient Name</span>
          <input type="text" value={s.bossName} onChange={e => update({ bossName: e.target.value })} />
        </label>

        <label className="field">
          <span>Email Subject Format</span>
          <input type="text" value={s.emailSubjectFormat} onChange={e => update({ emailSubjectFormat: e.target.value })} />
          <small className="field__hint">Use {'{date}'} for the formatted date</small>
        </label>

        <label className="field">
          <span>Greeting</span>
          <textarea value={s.greeting} onChange={e => update({ greeting: e.target.value })} rows={2} />
          <small className="field__hint">Use {'{boss}'} for the recipient name</small>
        </label>

        <label className="field">
          <span>Sign-off</span>
          <textarea value={s.signoff} onChange={e => update({ signoff: e.target.value })} rows={2} />
          <small className="field__hint">Use {'{name}'} for your name</small>
        </label>
      </section>

      {/* Tag Management Sections */}
      <section className="settings__section">
        <h3>Projects</h3>
        <TagListEditor category="project" title="Projects" />
      </section>

      <section className="settings__section">
        <h3>Value Categories</h3>
        <TagListEditor category="value_category" title="Value Categories" />
      </section>

      <section className="settings__section">
        <h3>Output Types</h3>
        <TagListEditor category="output_type" title="Output Types" />
      </section>

      <section className="settings__section">
        <h3>Work Styles</h3>
        <TagListEditor category="work_style" title="Work Styles" />
      </section>

      <section className="settings__section">
        <h3>Session Statuses</h3>
        <TagListEditor category="session_status" title="Session Statuses" />
      </section>

      <section className="settings__section">
        <h3>Auto Daily Email</h3>
        <p className="settings__info">
          Automatically send your daily work summary at the end of each workday.
        </p>

        <label className="field field--checkbox">
          <input type="checkbox" checked={s.autoEmailEnabled} onChange={e => update({ autoEmailEnabled: e.target.checked })} />
          <span>Enable automatic daily email</span>
        </label>

        {s.autoEmailEnabled && (
          <>
            <label className="field">
              <span>Recipient Email(s)</span>
              <input type="text" value={s.autoEmailRecipient} onChange={e => update({ autoEmailRecipient: e.target.value })} placeholder="boss@company.com, team-channel@company.com" />
              <small className="field__hint">Comma-separated emails. Tip: use your Teams channel email to get push notifications.</small>
            </label>

            <label className="field">
              <span>Send Time</span>
              <input type="time" value={s.autoEmailTime} onChange={e => update({ autoEmailTime: e.target.value })} />
              <small className="field__hint">Time to send the daily email (weekdays only).</small>
            </label>

            <label className="field">
              <span>Minimum Tracked Hours</span>
              <input type="number" value={s.autoEmailMinHours} onChange={e => update({ autoEmailMinHours: Math.max(0, parseInt(e.target.value) || 0) })} min={0} max={12} step={1} />
              <small className="field__hint">Email won't auto-send unless you've tracked at least this many hours.</small>
            </label>

            <label className="field">
              <span>Max Untracked Gap (minutes)</span>
              <input type="number" value={s.autoEmailMaxGapMin} onChange={e => update({ autoEmailMaxGapMin: Math.max(0, parseInt(e.target.value) || 0) })} min={0} max={480} step={15} />
              <small className="field__hint">Email won't auto-send if any untracked gap exceeds this.</small>
            </label>
          </>
        )}
      </section>

      <section className="settings__section">
        <h3>Push Notifications</h3>
        {pushSupported ? (
          <>
            <p className="settings__info">Get push notifications for idle time warnings and email alerts.</p>
            <label className="field field--checkbox">
              <input type="checkbox" checked={pushEnabled} onChange={handlePushToggle} disabled={pushLoading} />
              <span>{pushLoading ? 'Setting up...' : 'Enable push notifications'}</span>
            </label>
          </>
        ) : (
          <p className="settings__info">Push notifications are not supported in this browser. Add TaskPanels to your Home Screen for best results.</p>
        )}
      </section>

      <section className="settings__section">
        <h3>Preferences</h3>

        <label className="field">
          <span>Time Format</span>
          <select value={s.timeFormat} onChange={e => update({ timeFormat: e.target.value as '12h' | '24h' })}>
            <option value="12h">12-hour (8:30 AM)</option>
            <option value="24h">24-hour (08:30)</option>
          </select>
        </label>

        <label className="field">
          <span>Idle Warning (minutes)</span>
          <input type="number" value={s.idleWarningMinutes} onChange={e => update({ idleWarningMinutes: parseInt(e.target.value) || 15 })} min={1} max={120} />
        </label>

        <label className="field field--checkbox">
          <input type="checkbox" checked={s.darkMode} onChange={e => update({ darkMode: e.target.checked })} />
          <span>Dark mode</span>
        </label>
      </section>

      <section className="settings__section">
        <h3>Keyboard Shortcuts</h3>
        <div className="settings__shortcuts">
          <div className="shortcut-row"><kbd>1</kbd>–<kbd>9</kbd> Start task by position</div>
          <div className="shortcut-row"><kbd>Esc</kbd> Stop current task</div>
          <div className="shortcut-row"><kbd>R</kbd> Resume last task</div>
          <div className="shortcut-row"><kbd>D</kbd> Toggle dark mode</div>
        </div>
      </section>

      <section className="settings__section">
        <h3>Account</h3>
        <p className="settings__info">Your data is synced to the cloud.</p>
        <button
          className="btn btn--danger-outline"
          onClick={async () => {
            if (!confirm('Sign out and clear cached data? Your cloud data is safe.')) return;
            const appKeys = Object.keys(localStorage).filter(k =>
              k.startsWith('tp_') || k.startsWith('time-tracker') || k.startsWith('entries_') || k.startsWith('tasks') || k.startsWith('settings') || k.startsWith('daily-note')
            );
            appKeys.forEach(k => localStorage.removeItem(k));
            await signOut();
          }}
        >
          Sign Out & Clear Cache
        </button>
      </section>
    </div>
  );
};
