// ============================================================
// Team Editor — CRUD for teams and their task presets
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TASK_COLORS, getNextColor } from '../../utils/colors';

interface Team {
  id: string;
  name: string;
}

interface TeamTask {
  id: string;
  team_id: string;
  name: string;
  color: string;
  order: number;
}

export const TeamEditor: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);

  // New team form
  const [newTeamName, setNewTeamName] = useState('');

  // New task form
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskColor, setNewTaskColor] = useState<string>(TASK_COLORS[0]);

  // Edit team name
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('*').order('name');
      setTeams((data ?? []) as Team[]);
      setLoading(false);
    };
    fetchTeams();
  }, []);

  // Fetch tasks when team is selected
  useEffect(() => {
    if (!selectedTeam) { setTasks([]); return; }
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('team_tasks')
        .select('*')
        .eq('team_id', selectedTeam)
        .order('"order"');
      setTasks((data ?? []) as TeamTask[]);
      setNewTaskColor(getNextColor((data ?? []).map((t: TeamTask) => t.color)));
    };
    fetchTasks();
  }, [selectedTeam]);

  // ---- Team CRUD ----

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: newTeamName.trim() })
      .select()
      .single();
    if (error) { alert(error.message); return; }
    setTeams(prev => [...prev, data as Team].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeamName('');
  };

  const handleRenameTeam = async (teamId: string) => {
    if (!editTeamName.trim()) return;
    const { error } = await supabase
      .from('teams')
      .update({ name: editTeamName.trim() })
      .eq('id', teamId);
    if (error) { alert(error.message); return; }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: editTeamName.trim() } : t));
    setEditingTeamId(null);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team and all its task presets? Users on this team will be unassigned.')) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) { alert(error.message); return; }
    setTeams(prev => prev.filter(t => t.id !== teamId));
    if (selectedTeam === teamId) { setSelectedTeam(null); setTasks([]); }
  };

  // ---- Task Preset CRUD ----

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedTeam) return;
    const { data, error } = await supabase
      .from('team_tasks')
      .insert({
        team_id: selectedTeam,
        name: newTaskName.trim(),
        color: newTaskColor,
        order: tasks.length,
      })
      .select()
      .single();
    if (error) { alert(error.message); return; }
    setTasks(prev => [...prev, data as TeamTask]);
    setNewTaskName('');
    setNewTaskColor(getNextColor([...tasks.map(t => t.color), newTaskColor]));
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task preset?')) return;
    const { error } = await supabase.from('team_tasks').delete().eq('id', taskId);
    if (error) { alert(error.message); return; }
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleUpdateTaskColor = async (taskId: string, color: string) => {
    const { error } = await supabase.from('team_tasks').update({ color }).eq('id', taskId);
    if (error) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, color } : t));
  };

  if (loading) return <p>Loading teams...</p>;

  return (
    <div className="team-editor">
      <div className="team-editor__layout">
        {/* Team list */}
        <div className="team-editor__sidebar">
          <h3>Teams</h3>
          <div className="team-editor__list">
            {teams.map(team => (
              <div
                key={team.id}
                className={`team-editor__team-item ${selectedTeam === team.id ? 'team-editor__team-item--selected' : ''}`}
              >
                {editingTeamId === team.id ? (
                  <div className="team-editor__rename">
                    <input
                      type="text"
                      value={editTeamName}
                      onChange={e => setEditTeamName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameTeam(team.id); }}
                      autoFocus
                    />
                    <button className="btn btn--small btn--primary" onClick={() => handleRenameTeam(team.id)}>Save</button>
                    <button className="btn btn--small btn--secondary" onClick={() => setEditingTeamId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span
                      className="team-editor__team-name"
                      onClick={() => setSelectedTeam(team.id)}
                    >
                      {team.name}
                    </span>
                    <div className="team-editor__team-actions">
                      <button
                        className="btn btn--icon"
                        onClick={() => { setEditingTeamId(team.id); setEditTeamName(team.name); }}
                        title="Rename"
                      >&#9998;</button>
                      <button
                        className="btn btn--icon btn--icon-danger"
                        onClick={() => handleDeleteTeam(team.id)}
                        title="Delete"
                      >&#10005;</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <form className="team-editor__add-team" onSubmit={handleAddTeam}>
            <input
              type="text"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="New team name..."
              maxLength={30}
            />
            <button type="submit" className="btn btn--primary btn--small" disabled={!newTeamName.trim()}>
              + Add
            </button>
          </form>
        </div>

        {/* Task presets for selected team */}
        <div className="team-editor__tasks">
          {selectedTeam ? (
            <>
              <h3>Task Presets: {teams.find(t => t.id === selectedTeam)?.name}</h3>
              <p className="team-editor__hint">
                These tasks are copied to new employees who join this team.
              </p>

              <div className="team-editor__task-list">
                {tasks.map(task => (
                  <div key={task.id} className="team-editor__task-row">
                    <span
                      className="team-editor__task-color"
                      style={{ backgroundColor: task.color }}
                      title="Click to change color"
                    />
                    <span className="team-editor__task-name">{task.name}</span>
                    <div className="team-editor__task-colors">
                      {TASK_COLORS.slice(0, 8).map(c => (
                        <button
                          key={c}
                          className={`color-swatch color-swatch--mini ${c === task.color ? 'color-swatch--selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => handleUpdateTaskColor(task.id, c)}
                        />
                      ))}
                    </div>
                    <button
                      className="btn btn--icon btn--icon-danger"
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete"
                    >&#10005;</button>
                  </div>
                ))}
              </div>

              <form className="team-editor__add-task" onSubmit={handleAddTask}>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="New task name..."
                  maxLength={30}
                />
                <div className="color-picker color-picker--inline">
                  {TASK_COLORS.slice(0, 8).map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch color-swatch--mini ${c === newTaskColor ? 'color-swatch--selected' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewTaskColor(c)}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn--primary btn--small" disabled={!newTaskName.trim()}>
                  + Add Task
                </button>
              </form>
            </>
          ) : (
            <p className="team-editor__empty">Select a team to manage its task presets.</p>
          )}
        </div>
      </div>
    </div>
  );
};
