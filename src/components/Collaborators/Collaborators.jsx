import React, { useState, useEffect } from 'react';
import {
  getProjects, parseMembers, addCollaborator, removeCollaborator, updateProject,
} from '../../appwrite/database';
import { adminListUsers } from '../../appwrite/adminClient';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../Dialog/Dialog';
import { Users, Plus, Trash2, Loader2, UserCheck, Search, X, FolderOpen } from 'lucide-react';
import './Collaborators.css';

export default function Collaborators() {
  const { state } = useApp();
  const { toast, confirm } = useDialog();

  const [projects, setProjects]     = useState([]);
  const [selProjId, setSelProjId]   = useState('');
  const [members, setMembers]       = useState([]);
  const [allUsers, setAllUsers]     = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [search, setSearch]         = useState('');
  const [adding, setAdding]         = useState(false);
  const [loading, setLoading]       = useState(false);

  const userId = state.user?.$id;

  // Load projects
  useEffect(() => {
    if (!userId) return;
    getProjects(userId).then(setProjects).catch(() => {});
  }, [userId]);

  // Auto-select active project
  useEffect(() => {
    if (state.activeProjectId && !selProjId) setSelProjId(state.activeProjectId);
  }, [state.activeProjectId]);

  // Load members when project changes
  useEffect(() => {
    if (!selProjId) { setMembers([]); return; }
    const proj = projects.find(p => p.$id === selProjId);
    setMembers(proj ? parseMembers(proj) : []);
  }, [selProjId, projects]);

  // Lazy-load users list (requires admin key)
  async function loadUsers() {
    if (usersLoaded) return;
    setLoading(true);
    try {
      const list = await adminListUsers();
      setAllUsers(list);
      setUsersLoaded(true);
    } catch {
      toast('Could not load users (Admin key required).', 'warning', 4000);
    } finally { setLoading(false); }
  }

  async function handleAdd(user) {
    if (!selProjId) return;
    setAdding(true);
    try {
      const updated = await addCollaborator(selProjId, user.$id, user.email, user.name);
      setMembers(parseMembers(updated));
      setProjects(prev => prev.map(p => p.$id === selProjId ? updated : p));
      setSearch('');
      toast(`${user.name} added as collaborator.`, 'success');
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
    finally { setAdding(false); }
  }

  async function handleRemove(memberId, memberName) {
    const ok = await confirm({
      title: 'Remove Collaborator',
      message: `Remove "${memberName}" from this project? They will lose access.`,
      confirmLabel: 'Remove', cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await removeCollaborator(selProjId, memberId);
      setMembers(parseMembers(updated));
      setProjects(prev => prev.map(p => p.$id === selProjId ? updated : p));
      toast(`${memberName} removed.`, 'success');
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
  }

  const memberIds = new Set(members.map(m => m.userId));
  const selectedProject = projects.find(p => p.$id === selProjId);

  // Filter users for the add search
  const filteredUsers = search.length >= 1
    ? allUsers.filter(u =>
        !memberIds.has(u.$id) &&
        u.$id !== selectedProject?.userId &&
        (u.name.toLowerCase().includes(search.toLowerCase()) ||
         u.email.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 8)
    : [];

  return (
    <div className="collab-panel">
      <div className="collab-header">
        <Users size={15} />
        <span>Project Collaborators</span>
      </div>

      {/* Project picker */}
      <div className="collab-proj-select-wrap">
        <FolderOpen size={12} className="collab-proj-icon" />
        <select
          className="collab-proj-select"
          value={selProjId}
          onChange={e => setSelProjId(e.target.value)}>
          <option value="">— Select a project —</option>
          {projects.map(p => (
            <option key={p.$id} value={p.$id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!selProjId && (
        <p className="collab-hint">Select a project above to manage its collaborators.</p>
      )}

      {selProjId && (
        <>
          {/* Current members */}
          <div className="collab-section-title">
            Members · {members.length}
          </div>
          {members.length === 0 && (
            <p className="collab-hint">No collaborators yet. Search for users below to add them.</p>
          )}
          <div className="collab-member-list">
            {members.map(m => (
              <div key={m.userId} className="collab-member-row">
                <div className="collab-member-avatar">{m.name?.charAt(0).toUpperCase() || '?'}</div>
                <div className="collab-member-info">
                  <span className="collab-member-name">{m.name}</span>
                  <span className="collab-member-email">{m.email}</span>
                </div>
                <button
                  className="btn btn-icon btn-ghost btn-sm collab-remove-btn"
                  title="Remove"
                  onClick={() => handleRemove(m.userId, m.name)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Add collaborator */}
          <div className="collab-section-title" style={{ marginTop: 16 }}>
            Add Collaborator
          </div>
          <div className="collab-search-wrap">
            <Search size={12} className="collab-search-icon" />
            <input
              className="collab-search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={loadUsers}
            />
            {search && (
              <button className="collab-clear-btn btn btn-icon btn-ghost btn-sm" onClick={() => setSearch('')}>
                <X size={11} />
              </button>
            )}
          </div>

          {loading && (
            <div className="collab-loading"><Loader2 size={14} className="spin" /> Loading users…</div>
          )}

          {!loading && search && filteredUsers.length === 0 && (
            <p className="collab-hint">No matching users found.</p>
          )}

          <div className="collab-results">
            {filteredUsers.map(u => (
              <div key={u.$id} className="collab-result-row">
                <div className="collab-member-avatar" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div className="collab-member-info">
                  <span className="collab-member-name">{u.name}</span>
                  <span className="collab-member-email">{u.email}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm collab-add-btn"
                  disabled={adding}
                  onClick={() => handleAdd(u)}>
                  {adding ? <Loader2 size={10} className="spin" /> : <Plus size={10} />}
                </button>
              </div>
            ))}
          </div>

          <p className="collab-note">
            💡 Collaborators can view and edit the project's requests and documentation. Requires Admin API key to search users.
          </p>
        </>
      )}
    </div>
  );
}
