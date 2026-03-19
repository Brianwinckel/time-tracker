// ============================================================
// Settings screen — email template, preferences
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';

export const Settings: React.FC = () => {
  const { state, dispatch } = useApp();
  const s = state.settings;

  const update = (patch: Partial<typeof s>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
  };

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="settings__section">
        <h3>Email Template</h3>

        <label className="field">
          <span>Your Name</span>
          <input
            type="text"
            value={s.myName}
            onChange={e => update({ myName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Boss / Recipient Name</span>
          <input
            type="text"
            value={s.bossName}
            onChange={e => update({ bossName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Email Subject Format</span>
          <input
            type="text"
            value={s.emailSubjectFormat}
            onChange={e => update({ emailSubjectFormat: e.target.value })}
          />
          <small className="field__hint">Use {'{date}'} for the formatted date</small>
        </label>

        <label className="field">
          <span>Greeting</span>
          <textarea
            value={s.greeting}
            onChange={e => update({ greeting: e.target.value })}
            rows={2}
          />
          <small className="field__hint">Use {'{boss}'} for the recipient name</small>
        </label>

        <label className="field">
          <span>Sign-off</span>
          <textarea
            value={s.signoff}
            onChange={e => update({ signoff: e.target.value })}
            rows={2}
          />
          <small className="field__hint">Use {'{name}'} for your name</small>
        </label>
      </section>

      <section className="settings__section">
        <h3>Preferences</h3>

        <label className="field">
          <span>Time Format</span>
          <select
            value={s.timeFormat}
            onChange={e => update({ timeFormat: e.target.value as '12h' | '24h' })}
          >
            <option value="12h">12-hour (8:30 AM)</option>
            <option value="24h">24-hour (08:30)</option>
          </select>
        </label>

        <label className="field">
          <span>Idle Warning (minutes)</span>
          <input
            type="number"
            value={s.idleWarningMinutes}
            onChange={e => update({ idleWarningMinutes: parseInt(e.target.value) || 15 })}
            min={1}
            max={120}
          />
        </label>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={s.darkMode}
            onChange={e => update({ darkMode: e.target.checked })}
          />
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
        <h3>Data</h3>
        <p className="settings__info">
          All data is stored locally in your browser. Nothing is sent to any server.
        </p>
        <button
          className="btn btn--danger-outline"
          onClick={() => {
            if (confirm('This will delete ALL your data. Are you sure?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
        >
          Reset All Data
        </button>
      </section>
    </div>
  );
};
