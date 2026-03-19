// ============================================================
// Admin Panel — tabs for Teams, Users, Invite
// ============================================================

import React, { useState } from 'react';
import { TeamEditor } from './TeamEditor';
import { UserTable } from './UserTable';
import { InviteForm } from './InviteForm';

type Tab = 'teams' | 'users' | 'invite';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('teams');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teams', label: 'Teams & Tasks' },
    { id: 'users', label: 'Users' },
    { id: 'invite', label: 'Invite' },
  ];

  return (
    <div className="admin">
      <h2>Admin Panel</h2>

      <div className="admin__tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin__tab ${activeTab === tab.id ? 'admin__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin__content">
        {activeTab === 'teams' && <TeamEditor />}
        {activeTab === 'users' && <UserTable />}
        {activeTab === 'invite' && <InviteForm />}
      </div>
    </div>
  );
};
