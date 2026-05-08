import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../Dialog/Dialog';
import {
  getProjects, createProject, updateProject, deleteProject as deleteProjectDB,
  getRequests, deleteRequest as deleteRequestDB,
  logout, isAdmin,
  saveRequest, addCollaborator, removeCollaborator, getCollaborators, getSharedProjects,
  getPendingInvites,
} from '../../appwrite/database';
import { downloadPostmanExport } from '../../utils/postmanExport';
import { importFromPostman } from '../../utils/postmanImport';
import { loadEnvSets, saveEnvSets, getActiveEnvId, setActiveEnvId, cloneEnvSet, generateEnvId } from '../../utils/envVars';
import {
  FolderOpen, Folder, ChevronRight, Plus, Trash2, Upload, Download,
  Clock, Zap, Settings, X, Edit2, Check,
  LogOut, Shield, Loader2, Sliders, Copy, Users, ArrowLeft, Mail, MessageSquare, Bell,
} from 'lucide-react';
import FeedbackModal from '../FeedbackModal/FeedbackModal';
import InvitesModal from '../InvitesModal/InvitesModal';
import DownloadModal from '../DownloadModal/DownloadModal';
import { CURRENT_VERSION } from '../../hooks/useUpdateCheck';
import './Sidebar.css';

export default function Sidebar({ onOpenSettings }) {
  const { state, dispatch } = useApp();
  const { toast, confirm } = useDialog();
  const navigate = useNavigate();

  const [projects, setProjects]             = useState([]);
  const [requests, setRequests]             = useState([]);
  const [history, setHistory]               = useState(() => JSON.parse(localStorage.getItem('nexus_history') || '[]'));
  const [tab, setTab]                       = useState('collections');
  const [showFeedback, setShowFeedback]     = useState(false);
  const [showDownload, setShowDownload]     = useState(false);
  const [showInvites, setShowInvites]       = useState(false);
  const [pendingCount, setPendingCount]     = useState(0);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Detect if running as installed PWA (standalone display-mode)
  // Hide the download button when already running as an installed app:
  // - PWA standalone mode (browser install)
  // - Electron desktop app
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || window.electronAPI?.isElectron === true;

  // Import progress
  const [importProgress, setImportProgress] = useState(null);

  // New project form
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId]           = useState(null);
  const [editName, setEditName]             = useState('');
  const [openFolders, setOpenFolders]       = useState({});

  // Folder creation
  const [showNewFolder, setShowNewFolder]   = useState(false);
  const [newFolderName, setNewFolderName]   = useState('');

  // Multi-select
  const [selectMode, setSelectMode]         = useState(false);
  const [selectedIds, setSelectedIds]       = useState(new Set());

  // Inline collaborator panel (email-invite, no admin key needed)
  const [collabProjectId, setCollabProjectId] = useState(null);
  const [collabMembers, setCollabMembers]     = useState([]);
  const [collabLoading, setCollabLoading]     = useState(false);
  const [collabEmail, setCollabEmail]         = useState('');
  const [collabName, setCollabName]           = useState('');
  const [collabAdding, setCollabAdding]       = useState(false);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(requests.map(r => r.$id)));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  // Env sets (multi-environment, project-scoped, localStorage)
  const [envSets, setEnvSets]       = useState([]);
  const [activeEnvId, setActiveEnvIdState] = useState('');

  // Load env sets when project changes
  useEffect(() => {
    if (state.activeProjectId) {
      const sets = loadEnvSets(state.activeProjectId);
      setEnvSets(sets);
      setActiveEnvIdState(getActiveEnvId(state.activeProjectId) || sets[0]?.id || '');
    } else {
      setEnvSets([]);
      setActiveEnvIdState('');
    }
  }, [state.activeProjectId]);

  function persistEnvSets(newSets) {
    setEnvSets(newSets);
    if (state.activeProjectId) saveEnvSets(state.activeProjectId, newSets);
  }

  function persistActiveEnv(envId) {
    setActiveEnvIdState(envId);
    if (state.activeProjectId) setActiveEnvId(state.activeProjectId, envId);
  }

  const userId    = state.user?.$id;
  const userEmail = state.user?.email;

  // ── Load projects (owned + accepted shared) ────────────────────────────────
  const loadProjects = useCallback(async () => {
    if (!userId) return;
    setProjectsLoading(true);
    try {
      const [owned, shared] = await Promise.all([
        getProjects(userId),
        getSharedProjects(userEmail),
      ]);
      // Merge: owned first, then shared ones not already in owned list
      const ownedIds = new Set(owned.map(p => p.$id));
      const merged   = [...owned, ...shared.filter(p => !ownedIds.has(p.$id))];
      setProjects(merged);
    } catch (e) { toast('Failed to load projects: ' + e.message, 'error'); }
    finally { setProjectsLoading(false); }
  }, [userId, userEmail]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Poll pending invites for bell badge ───────────────────────────────────
  const loadPendingCount = useCallback(async () => {
    if (!userEmail) return;
    try {
      const list = await getPendingInvites(userEmail);
      setPendingCount(list.length);
    } catch { /* silent */ }
  }, [userEmail]);

  useEffect(() => {
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 60_000); // re-check every 60s
    return () => clearInterval(interval);
  }, [loadPendingCount]);

  // ── Load requests when active project changes ──────────────────────────────
  useEffect(() => {
    if (!state.activeProjectId) { setRequests([]); return; }
    setRequestsLoading(true);
    getRequests(state.activeProjectId)
      .then(setRequests)
      .catch(e => toast('Failed to load requests: ' + e.message, 'error'))
      .finally(() => setRequestsLoading(false));
  }, [state.activeProjectId]);

  // Expose requests loader so RequestBuilder can trigger a refresh
  useEffect(() => {
    window.__nexusRefreshRequests = () => {
      if (!state.activeProjectId) return;
      getRequests(state.activeProjectId).then(setRequests).catch(() => {});
    };
  }, [state.activeProjectId]);

  // ── Project CRUD ───────────────────────────────────────────────────────────
  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    try {
      const p = await createProject(newProjectName.trim(), userId);
      setProjects(prev => [p, ...prev]);
      dispatch({ type: 'SET_ACTIVE_PROJECT', payload: p.$id });
      toast(`Project "${p.name}" created.`, 'success');
    } catch (e) { toast('Failed to create project: ' + e.message, 'error'); }
    setNewProjectName(''); setShowNewProject(false);
  }

  async function handleDeleteProject(project) {
    const ok = await confirm({
      title: 'Delete Project',
      message: `"${project.name}" and all its saved requests will be permanently deleted.`,
      confirmLabel: 'Delete Project', cancelLabel: 'Keep It', variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteProjectDB(project.$id);
      setProjects(prev => prev.filter(p => p.$id !== project.$id));
      if (state.activeProjectId === project.$id) dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null });
      toast('Project deleted.', 'success');
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    try {
      await updateProject(id, { name: editName.trim() });
      setProjects(prev => prev.map(p => p.$id === id ? { ...p, name: editName.trim() } : p));
    } catch (e) { toast('Update failed: ' + e.message, 'error'); }
    setEditingId(null);
  }

  // ── Request actions ────────────────────────────────────────────────────────
  async function handleDeleteRequest(req) {
    const ok = await confirm({
      title: 'Delete Request', message: `"${req.name || req.url}" will be removed.`,
      confirmLabel: 'Delete', cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteRequestDB(req.$id);
      setRequests(prev => prev.filter(r => r.$id !== req.$id));
      if (state.activeRequestId === req.$id) dispatch({ type: 'SET_ACTIVE_REQUEST', payload: null });
      toast('Request deleted.', 'success');
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Delete Selected',
      message: `${selectedIds.size} request${selectedIds.size > 1 ? 's' : ''} will be permanently deleted.`,
      confirmLabel: `Delete ${selectedIds.size}`, cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    let deleted = 0;
    for (const id of selectedIds) {
      try { await deleteRequestDB(id); deleted++; } catch {}
    }
    setRequests(prev => prev.filter(r => !selectedIds.has(r.$id)));
    if (selectedIds.has(state.activeRequestId)) dispatch({ type: 'SET_ACTIVE_REQUEST', payload: null });
    exitSelectMode();
    toast(`Deleted ${deleted} request${deleted !== 1 ? 's' : ''}.`, 'success');
  }

  async function handleDeleteFolder(folderName) {
    const folderReqs = requests.filter(r => r.folder === folderName);
    const ok = await confirm({
      title: 'Delete Folder',
      message: `"${folderName}" and its ${folderReqs.length} request${folderReqs.length !== 1 ? 's' : ''} will be permanently deleted.`,
      confirmLabel: 'Delete Folder', cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    let deleted = 0;
    for (const req of folderReqs) {
      try { await deleteRequestDB(req.$id); deleted++; } catch {}
    }
    setRequests(prev => prev.filter(r => r.folder !== folderName));
    if (folderReqs.some(r => r.$id === state.activeRequestId))
      dispatch({ type: 'SET_ACTIVE_REQUEST', payload: null });
    toast(`Folder "${folderName}" deleted (${deleted} requests).`, 'success');
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (!state.activeProjectId) { toast('Select a project first.', 'warning'); return; }
    // Create a placeholder request to establish the folder, or just open folder in UI
    // We create an empty "folder marker" as a real request in Appwrite with folder set
    try {
      const saved = await saveRequest({
        projectId: state.activeProjectId,
        userId: state.user?.$id,
        name: 'New Request',
        method: 'GET',
        url: '',
        folder: name,
        params: [], headers: [], body: '', bodyType: 'json',
        auth: { type: 'none' }, description: '',
      });
      setRequests(prev => [...prev, saved]);
      setOpenFolders(prev => ({ ...prev, [name]: true }));
      dispatch({ type: 'SET_ACTIVE_REQUEST', payload: saved.$id });
      toast(`Folder "${name}" created with a starter request.`, 'success');
    } catch (e) { toast('Failed to create folder: ' + e.message, 'error'); }
    setNewFolderName('');
    setShowNewFolder(false);
  }

  async function handleMoveToFolder(req, targetFolder) {
    try {
      const { updateRequest } = await import('../../appwrite/database');
      await updateRequest(req.$id, { ...req, folder: targetFolder });
      setRequests(prev => prev.map(r => r.$id === req.$id ? { ...r, folder: targetFolder } : r));
      toast(`Moved to "${targetFolder || 'root'}".`, 'success');
    } catch (e) { toast('Move failed: ' + e.message, 'error'); }
  }

  // ── Postman Import ─────────────────────────────────────────────────────────
  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async ev => {
      let projectName = 'Imported Collection';
      try {
        const json = JSON.parse(ev.target.result);
        const { projectName: pName, requests: imported } = importFromPostman(json);
        projectName = pName;

        if (imported.length === 0) {
          toast('No requests found in this collection.', 'warning'); return;
        }

        // Create project first
        const project = await createProject(projectName, userId);
        setProjects(prev => [project, ...prev]);
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project.$id });

        // Show progress overlay immediately
        setImportProgress({ name: projectName, total: imported.length, saved: 0, failed: 0 });

        // Save in parallel batches of 5 for speed + live progress
        const BATCH = 5;
        let saved = 0, failed = 0;

        for (let i = 0; i < imported.length; i += BATCH) {
          const batch = imported.slice(i, i + BATCH);
          const results = await Promise.allSettled(
            batch.map(req => saveRequest({ ...req, projectId: project.$id, userId }))
          );
          results.forEach(r => r.status === 'fulfilled' ? saved++ : failed++);
          // Live update the progress bar
          setImportProgress(prev => prev ? { ...prev, saved, failed } : null);
        }

        // Done — clear progress and show result
        setImportProgress(null);
        window.__nexusRefreshRequests?.();

        if (failed === 0) {
          toast(`✓ "${projectName}" imported — ${saved} requests across ${countFolders(imported)} folders.`, 'success', 5000);
        } else {
          toast(`"${projectName}" imported — ${saved} saved, ${failed} failed.`, 'warning', 6000);
        }
      } catch (err) {
        setImportProgress(null);
        if (err instanceof SyntaxError) {
          toast('Invalid JSON file. Please export a valid Postman Collection v2.1.', 'error', 6000);
        } else {
          toast('Import failed: ' + err.message, 'error', 6000);
        }
      }
    };
    reader.readAsText(file);
  }

  function countFolders(reqs) {
    return new Set(reqs.filter(r => r.folder).map(r => r.folder.split('/')[0])).size;
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    const project = projects.find(p => p.$id === state.activeProjectId);
    if (!project) return;
    downloadPostmanExport(project.name, requests);
    toast('Exported as Postman collection.', 'success');
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    const ok = await confirm({ title: 'Sign Out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign Out', variant: 'warning' });
    if (!ok) return;
    await logout();
    dispatch({ type: 'SET_USER', payload: null });
    navigate('/login');
  }

  // ── History ────────────────────────────────────────────────────────────────
  function clearHistory() { localStorage.removeItem('nexus_history'); setHistory([]); }

  // ── Inline Collaborators ────────────────────────────────────────────────────
  async function openCollabPanel(project, e) {
    e.stopPropagation();
    if (collabProjectId === project.$id) { setCollabProjectId(null); return; }
    setCollabProjectId(project.$id);
    setCollabEmail('');
    setCollabName('');
    setCollabLoading(true);
    try {
      const members = await getCollaborators(project.$id);
      setCollabMembers(members);
    } catch { setCollabMembers([]); }
    finally { setCollabLoading(false); }
  }

  async function handleCollabAdd(e) {
    e.preventDefault();
    const email = collabEmail.trim();
    if (!email || !collabProjectId) return;
    setCollabAdding(true);
    try {
      await addCollaborator(
        collabProjectId,
        email,
        collabName.trim() || email,
        state.user?.$id,
        state.user?.name,
      );
      const updated = await getCollaborators(collabProjectId);
      setCollabMembers(updated);
      setCollabEmail('');
      setCollabName('');
      toast(`${collabName.trim() || email} added as collaborator.`, 'success');
    } catch (e) {
      toast('Failed to add: ' + e.message, 'error');
    } finally { setCollabAdding(false); }
  }

  async function handleCollabRemove(memberId, displayName) {
    const ok = await confirm({
      title: 'Remove Collaborator',
      message: `Remove "${displayName}" from this project?`,
      confirmLabel: 'Remove', cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    try {
      await removeCollaborator(memberId);
      setCollabMembers(prev => prev.filter(m => m.$id !== memberId));
      toast(`${displayName} removed.`, 'success');
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
  }

  return (
    <>
    <aside className="sidebar">
      {/* Logo row — settings button sits at the far right */}
      <div className="sidebar-logo">
        <img src="/flash.png" className="logo-img" alt="Nexus" />
        <div className="logo-text-group">
          <span className="logo-text">Nexus</span>
          <span className="logo-version-badge">v{CURRENT_VERSION}</span>
        </div>
        <button className="btn btn-icon btn-ghost btn-sm logo-settings-btn" onClick={onOpenSettings} data-tooltip="Settings">
          <Settings size={13} />
        </button>
      </div>

      {/* User pill — with personal action buttons on the right */}
      <div className="sidebar-user">
        <div className="user-pill-avatar">{state.user?.name?.charAt(0).toUpperCase()}</div>
        <div className="user-pill-info">
          <span className="user-pill-name">{state.user?.name}</span>
          {isAdmin(state.user) && <span className="user-pill-badge">Admin</span>}
        </div>
        {/* Personal actions — right of the name (no settings, that's in logo row) */}
        <div className="user-pill-actions">
          <div className="sidebar-invite-btn-wrap">
            <button
              className="btn btn-icon btn-ghost btn-sm"
              onClick={() => setShowInvites(true)}
              data-tooltip="Project Invitations">
              <Bell size={13} />
            </button>
            {pendingCount > 0 && (
              <span className="sidebar-invite-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
            )}
          </div>
          {isAdmin(state.user) && (
            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => navigate('/admin')} data-tooltip="Admin Panel"><Shield size={13} /></button>
          )}
          <button className="btn btn-icon btn-ghost btn-sm" onClick={handleLogout} data-tooltip="Sign Out"><LogOut size={13} /></button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="sidebar-tabs">
        {['collections', 'envs', 'history'].map(t => (
          <button key={t} className={`sidebar-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'collections' && <FolderOpen size={13} />}
            {t === 'envs'        && <Sliders size={13} />}
            {t === 'history'     && <Clock size={13} />}
            <span>{t === 'envs' ? 'Envs' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {/* ── Import Progress Overlay ── */}
        {importProgress && (
          <div className="import-progress-panel">
            <div className="import-progress-header">
              <Loader2 size={13} className="spin" />
              <span className="import-progress-title">Importing collection…</span>
            </div>
            <p className="import-progress-name">{importProgress.name}</p>
            <div className="import-progress-bar-track">
              <div
                className="import-progress-bar-fill"
                style={{ width: `${Math.round((importProgress.saved + importProgress.failed) / importProgress.total * 100)}%` }}
              />
            </div>
            <div className="import-progress-stats">
              <span className="import-progress-count">
                {importProgress.saved + importProgress.failed} / {importProgress.total}
              </span>
              <span className="import-progress-pct">
                {Math.round((importProgress.saved + importProgress.failed) / importProgress.total * 100)}%
              </span>
            </div>
            {importProgress.failed > 0 && (
              <p className="import-progress-failed">{importProgress.failed} failed</p>
            )}
          </div>
        )}

        {/* ── Collections ── */}
        {tab === 'collections' && (
          <>
            <div className="sidebar-section-header">
              <span>Projects</span>
              <div className="flex gap-4">
                <label className="btn btn-icon btn-ghost" data-tooltip="Import Postman JSON">
                  <Upload size={13} />
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                </label>
                <button className="btn btn-icon btn-ghost" onClick={() => setShowNewProject(!showNewProject)} data-tooltip="New Project">
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {showNewProject && (
              <div className="new-project-form">
                <input className="input" placeholder="Project name…" value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateProject()} autoFocus />
                <div className="flex gap-6 mt-6">
                  <button className="btn btn-primary btn-sm flex-1" onClick={handleCreateProject}>Create</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(false)}><X size={12} /></button>
                </div>
              </div>
            )}

            {projectsLoading && <div className="sidebar-loader"><Loader2 size={16} className="spin" /></div>}

            <div className="project-list">
              {projects.map(project => (
                <div key={project.$id} className={`project-item ${state.activeProjectId === project.$id ? 'active' : ''}`}>
                  <div className="project-header" onClick={() => dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project.$id })}>
                    <FolderOpen size={13} className="project-icon" />
                    {editingId === project.$id ? (
                      <input className="input project-edit-input" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(project.$id); if (e.key === 'Escape') setEditingId(null); }}
                        onClick={e => e.stopPropagation()} autoFocus />
                    ) : (
                      <span className="project-name">{project.name}</span>
                    )}
                    <div className="project-actions" onClick={e => e.stopPropagation()}>
                      {editingId === project.$id
                        ? <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleSaveEdit(project.$id)}><Check size={11} /></button>
                        : <button className="btn btn-icon btn-ghost btn-sm" onClick={() => { setEditingId(project.$id); setEditName(project.name); }}><Edit2 size={11} /></button>
                      }
                      {/* Collaborators icon */}
                      <button
                        className={`btn btn-icon btn-ghost btn-sm ${collabProjectId === project.$id ? 'collab-btn-active' : ''}`}
                        title="Collaborators"
                        onClick={e => {
                          if (collabProjectId === project.$id) { setCollabProjectId(null); }
                          else { openCollabPanel(project, e); }
                        }}>
                        <Users size={11} />
                      </button>
                      {state.activeProjectId === project.$id && (
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={handleExport} data-tooltip="Export Postman JSON"><Download size={11} /></button>
                      )}
                      <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDeleteProject(project)}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  {/* ── Inline Collaborators Panel ── */}
                  {collabProjectId === project.$id && (
                    <div className="collab-inline-panel">
                      <div className="collab-inline-header">
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setCollabProjectId(null)} title="Back">
                          <ArrowLeft size={12} />
                        </button>
                        <Users size={12} />
                        <span>Collaborators</span>
                        <span className="collab-inline-count">{collabMembers.length}</span>
                      </div>

                      {/* Loading */}
                      {collabLoading && (
                        <div className="collab-inline-loading"><Loader2 size={12} className="spin" /> Loading…</div>
                      )}

                      {/* Member list */}
                      {!collabLoading && collabMembers.length === 0 && (
                        <p className="collab-inline-hint">No collaborators yet. Invite someone below.</p>
                      )}
                      {collabMembers.map(m => (
                        <div key={m.$id} className="collab-inline-row">
                          <div className="collab-inline-avatar">{(m.invitedName || m.invitedEmail)?.charAt(0).toUpperCase()}</div>
                          <div className="collab-inline-info">
                            <span className="collab-inline-name">{m.invitedName || m.invitedEmail}</span>
                            <span className="collab-inline-email">{m.invitedEmail}</span>
                          </div>
                          <button
                            className="btn btn-icon btn-ghost btn-sm collab-inline-remove"
                            onClick={() => handleCollabRemove(m.$id, m.invitedName || m.invitedEmail)}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}

                      {/* Invite form */}
                      <form className="collab-invite-form" onSubmit={handleCollabAdd}>
                        <div className="collab-invite-title">
                          <Mail size={11} /> Invite by email
                        </div>
                        <input
                          className="collab-invite-input"
                          type="email"
                          placeholder="colleague@email.com"
                          value={collabEmail}
                          onChange={e => setCollabEmail(e.target.value)}
                          required
                        />
                        <input
                          className="collab-invite-input"
                          type="text"
                          placeholder="Name (optional)"
                          value={collabName}
                          onChange={e => setCollabName(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm collab-invite-btn"
                          disabled={collabAdding || !collabEmail.trim()}>
                          {collabAdding ? <Loader2 size={11} className="spin" /> : <Plus size={11} />}
                          {collabAdding ? 'Adding…' : 'Add Collaborator'}
                        </button>
                      </form>
                    </div>
                  )}

                  {state.activeProjectId === project.$id && (
                    <div className="request-list">
                      {/* ── Request toolbar ── */}
                      {!requestsLoading && (
                        <div className="req-toolbar">
                          <button
                            className="btn btn-icon btn-ghost btn-sm"
                            title="New Folder"
                            onClick={() => { setShowNewFolder(!showNewFolder); setNewFolderName(''); }}>
                            <FolderOpen size={12}/>
                            <Plus size={10} style={{ marginLeft: -4 }}/>
                          </button>
                          {requests.length > 0 && (
                            <button
                              className={`btn btn-icon btn-ghost btn-sm ${selectMode ? 'active' : ''}`}
                              title={selectMode ? 'Exit select mode' : 'Select multiple'}
                              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                              <Check size={12}/>
                            </button>
                          )}
                          {selectMode && selectedIds.size > 0 && (
                            <>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={selectAll}>All</button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: 10 }}
                                onClick={handleBulkDelete}>
                                <Trash2 size={10}/> {selectedIds.size}
                              </button>
                            </>
                          )}
                          {selectMode && selectedIds.size === 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tap to select</span>
                          )}
                        </div>
                      )}

                      {/* ── New folder form ── */}
                      {showNewFolder && (
                        <div className="new-folder-form">
                          <FolderOpen size={12} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                          <input
                            className="input"
                            placeholder="Folder name…"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateFolder();
                              if (e.key === 'Escape') setShowNewFolder(false);
                            }}
                            autoFocus
                            style={{ flex: 1, fontSize: 12 }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={handleCreateFolder}>Add</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowNewFolder(false)}><X size={11}/></button>
                        </div>
                      )}

                      {requestsLoading && <div className="sidebar-loader"><Loader2 size={14} className="spin" /></div>}
                      {!requestsLoading && requests.length === 0 && (
                        <p className="no-requests">No saved requests yet.<br/>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Use the folder icon above to create a folder, or save a request from the editor.</span>
                        </p>
                      )}
                      {!requestsLoading && requests.length > 0 && (
                        <RequestTree
                          requests={requests}
                          activeId={state.activeRequestId}
                          openFolders={openFolders}
                          selectMode={selectMode}
                          selectedIds={selectedIds}
                          allFolders={[...new Set(requests.filter(r => r.folder).map(r => r.folder))]}
                          onToggleFolder={key => setOpenFolders(prev => ({ ...prev, [key]: !prev[key] }))}
                          onSelect={id => dispatch({ type: 'SET_ACTIVE_REQUEST', payload: id })}
                          onToggleSelect={toggleSelect}
                          onDelete={handleDeleteRequest}
                          onDeleteFolder={handleDeleteFolder}
                          onMoveToFolder={handleMoveToFolder}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!projectsLoading && projects.length === 0 && (
                <div className="empty-state" style={{ padding: '32px 12px' }}>
                  <FolderOpen size={32} />
                  <p>No projects yet.<br />Create one or import a Postman collection.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Envs ── */}
        {tab === 'envs' && (
          <EnvVarEditor
            projectId={state.activeProjectId}
            envSets={envSets}
            activeEnvId={activeEnvId}
            onSetsChange={persistEnvSets}
            onActiveChange={persistActiveEnv}
          />
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <>
            <div className="sidebar-section-header">
              <span>Recent</span>
              {history.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearHistory}>Clear</button>}
            </div>
            <div className="history-list">
              {history.length === 0 && <div className="empty-state" style={{ padding: '32px 12px' }}><Clock size={32} /><p>No history yet.</p></div>}
              {history.map((item, i) => (
                <div key={i} className="history-item">
                  <span className={`method-tag method-${item.method}`}>{item.method}</span>
                  <div className="history-url">{item.url}</div>
                  <span className="history-status" style={{ color: item.status < 300 ? 'var(--green)' : item.status < 500 ? 'var(--orange)' : 'var(--red)' }}>
                    {item.status || '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Sidebar Footer ── */}
      <div className="sidebar-footer">
        {!isPWA && (
          <button
            className="sidebar-download-btn"
            onClick={() => setShowDownload(true)}>
            <Download size={12} />
            Download App
          </button>
        )}
        <button
          className="sidebar-feedback-btn"
          onClick={() => setShowFeedback(true)}>
          <MessageSquare size={12} />
          Send Feedback
        </button>
        <p className="sidebar-copyright">
          © {new Date().getFullYear()} Eduzere · All rights reserved
        </p>
      </div>
    </aside>

    {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    {showDownload && <DownloadModal onClose={() => setShowDownload(false)} />}
    {showInvites && (
      <InvitesModal
        user={state.user}
        onClose={() => { setShowInvites(false); loadPendingCount(); }}
        onAccepted={() => { loadProjects(); loadPendingCount(); }}
      />
    )}
    </>
  );
}

// ── RequestTree ─────────────────────────────────────────────────────────────────
function RequestTree({
  requests, activeId, openFolders, selectMode, selectedIds = new Set(), allFolders = [],
  onToggleFolder, onSelect, onToggleSelect, onDelete, onDeleteFolder, onMoveToFolder,
}) {
  const ungrouped = requests.filter(r => !r.folder);
  const folders   = {};
  requests.filter(r => r.folder).forEach(r => {
    const key = r.folder.split('/')[0];
    if (!folders[key]) folders[key] = [];
    folders[key].push(r);
  });

  return (
    <div className="req-tree">
      {ungrouped.map(req => (
        <RequestRow key={req.$id} req={req} activeId={activeId}
          selectMode={selectMode} selected={selectedIds.has(req.$id)}
          allFolders={allFolders}
          onSelect={onSelect} onToggleSelect={onToggleSelect}
          onDelete={onDelete} onMoveToFolder={onMoveToFolder} />
      ))}
      {Object.entries(folders).map(([folderName, folderReqs]) => {
        const isOpen = openFolders[folderName] !== false;
        const allSelected = selectMode && folderReqs.every(r => selectedIds.has(r.$id));
        return (
          <div key={folderName} className="req-folder">
            <div className="req-folder-header" onClick={() => onToggleFolder(folderName)}>
              <ChevronRight size={12} className={`folder-chevron ${isOpen ? 'open' : ''}`} />
              {isOpen ? <FolderOpen size={13} className="folder-icon-sm" /> : <Folder size={13} className="folder-icon-sm" />}
              <span className="folder-name">{folderName}</span>
              <span className="folder-count">{folderReqs.length}</span>
              <div className="folder-actions" onClick={e => e.stopPropagation()}>
                {selectMode && (
                  <button
                    className={`btn btn-icon btn-ghost btn-sm ${allSelected ? 'active' : ''}`}
                    title="Select all in folder"
                    onClick={() => folderReqs.forEach(r => onToggleSelect(r.$id))}>
                    <Check size={10}/>
                  </button>
                )}
                <button
                  className="btn btn-icon btn-ghost btn-sm folder-del-btn"
                  title="Delete folder"
                  onClick={() => onDeleteFolder(folderName)}>
                  <Trash2 size={10}/>
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="req-folder-body">
                {folderReqs.map(req => (
                  <RequestRow key={req.$id} req={req} activeId={activeId}
                    selectMode={selectMode} selected={selectedIds.has(req.$id)}
                    allFolders={allFolders}
                    onSelect={onSelect} onToggleSelect={onToggleSelect}
                    onDelete={onDelete} onMoveToFolder={onMoveToFolder}
                    indented />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestRow({ req, activeId, selectMode, selected, allFolders, onSelect, onToggleSelect, onDelete, onMoveToFolder, indented }) {
  const [showMove, setShowMove] = useState(false);
  const otherFolders = ['(root)', ...allFolders.filter(f => f !== req.folder)];

  function handleClick() {
    if (selectMode) { onToggleSelect(req.$id); return; }
    onSelect(req.$id);
  }

  return (
    <div
      className={`request-item ${activeId === req.$id ? 'active' : ''} ${indented ? 'request-item-indented' : ''} ${selectMode && selected ? 'req-selected' : ''}`}
      onClick={handleClick}>
      {selectMode && (
        <input type="checkbox" checked={selected} readOnly
          className="req-checkbox"
          onClick={e => { e.stopPropagation(); onToggleSelect(req.$id); }}/>
      )}
      <span className={`method-tag method-${req.method}`}>{req.method}</span>
      <span className="request-name">{req.name || req.url || 'Untitled'}</span>
      <div className="req-row-actions" onClick={e => e.stopPropagation()}>
        {!selectMode && allFolders.length > 0 && (
          <div className="req-move-wrap">
            <button
              className="req-move-btn btn btn-icon btn-ghost btn-sm"
              title="Move to folder"
              onClick={e => { e.stopPropagation(); setShowMove(!showMove); }}>
              <Folder size={10}/>
            </button>
            {showMove && (
              <div className="req-move-menu">
                {otherFolders.map(f => (
                  <button key={f} className="req-move-option"
                    onClick={() => { onMoveToFolder(req, f === '(root)' ? '' : f); setShowMove(false); }}>
                    {f === '(root)' ? '📂 Root' : `📁 ${f}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!selectMode && (
          <button className="req-delete-btn btn btn-icon btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); onDelete(req); }}>
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── EnvVarEditor (multi-environment) ─────────────────────────────────────────
function EnvVarEditor({ projectId, envSets, activeEnvId, onSetsChange, onActiveChange }) {
  const [showSecret, setShowSecret] = useState({});
  const [editingEnvName, setEditingEnvName] = useState(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [addingEnv, setAddingEnv] = useState(false);

  if (!projectId) return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <Sliders size={32} />
      <p>Select a project to manage its environments.</p>
    </div>
  );

  const activeSet = envSets.find(s => s.id === activeEnvId) || envSets[0] || { id: '', name: '', vars: [] };
  const vars = activeSet.vars || [];

  // ── Var editing ──────────────────────────────────────────────────────────────
  const ensure = list => {
    const hasEmpty = list.some(v => v.key === '');
    return hasEmpty ? list : [...list, { key: '', value: '', type: 'text', enabled: true }];
  };

  function updateVars(i, field, val) {
    const copy = [...vars];
    copy[i] = { ...copy[i], [field]: val };
    const cleaned = copy.filter((v, idx) => idx < copy.length - 1 ? v.key !== '' : true);
    const newSets = envSets.map(s => s.id === activeSet.id ? { ...s, vars: cleaned } : s);
    onSetsChange(newSets);
  }

  function removeVar(i) {
    const newVars = vars.filter((_, idx) => idx !== i);
    onSetsChange(envSets.map(s => s.id === activeSet.id ? { ...s, vars: newVars } : s));
  }

  // ── Environment management ───────────────────────────────────────────────────
  function addEnv() {
    const name = newEnvName.trim() || 'New Environment';
    const newSet = { id: generateEnvId(), name, vars: [] };
    const updated = [...envSets, newSet];
    onSetsChange(updated);
    onActiveChange(newSet.id);
    setAddingEnv(false);
    setNewEnvName('');
  }

  function cloneEnv() {
    const name = `${activeSet.name} (copy)`;
    const cloned = cloneEnvSet(activeSet, name);
    const updated = [...envSets, cloned];
    onSetsChange(updated);
    onActiveChange(cloned.id);
  }

  function deleteEnv() {
    if (envSets.length <= 1) return;
    const updated = envSets.filter(s => s.id !== activeSet.id);
    onSetsChange(updated);
    onActiveChange(updated[0]?.id || '');
  }

  function renameEnv(id, name) {
    onSetsChange(envSets.map(s => s.id === id ? { ...s, name } : s));
    setEditingEnvName(null);
  }

  const displayed = ensure(vars);

  return (
    <div className="env-editor-panel">
      {/* ── Environment switcher ── */}
      <div className="env-switcher">
        <div className="env-tabs-scroll">
          {envSets.map(s => (
            <div key={s.id} className={`env-tab-chip ${s.id === activeSet.id ? 'active' : ''}`}>
              {editingEnvName === s.id ? (
                <input
                  className="env-tab-name-input"
                  defaultValue={s.name}
                  autoFocus
                  onBlur={e => renameEnv(s.id, e.target.value || s.name)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameEnv(s.id, e.target.value || s.name);
                    if (e.key === 'Escape') setEditingEnvName(null);
                  }}
                />
              ) : (
                <span
                  className="env-tab-chip-label"
                  onClick={() => onActiveChange(s.id)}
                  onDoubleClick={() => setEditingEnvName(s.id)}>
                  {s.name}
                </span>
              )}
            </div>
          ))}
          {addingEnv ? (
            <input
              className="env-tab-name-input env-tab-name-new"
              value={newEnvName}
              onChange={e => setNewEnvName(e.target.value)}
              placeholder="Name…"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addEnv(); if (e.key === 'Escape') { setAddingEnv(false); setNewEnvName(''); } }}
              onBlur={() => { if (newEnvName.trim()) addEnv(); else { setAddingEnv(false); setNewEnvName(''); } }}
            />
          ) : (
            <button className="env-add-tab-btn" onClick={() => setAddingEnv(true)} title="New environment">
              <Plus size={11} />
            </button>
          )}
        </div>
        <div className="env-switcher-actions">
          <button className="btn btn-icon btn-ghost btn-sm" onClick={cloneEnv} title={`Duplicate "${activeSet.name}"`}>
            <Copy size={11} />
          </button>
          {envSets.length > 1 && (
            <button className="btn btn-icon btn-ghost btn-sm" onClick={deleteEnv} title={`Delete "${activeSet.name}"`}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="env-hint">
        Active: <strong>{activeSet.name}</strong> · Use <code>{'{{variable}}'}</code> in URLs, headers &amp; body.
        <br />Double-click an environment tab to rename it.
      </div>

      {/* ── Variables table ── */}
      <div className="env-table-wrap">
        <table className="env-table">
          <thead>
            <tr>
              <th style={{ width: 18 }} />
              <th>Variable</th>
              <th>Value</th>
              <th style={{ width: 60 }}>Type</th>
              <th style={{ width: 26 }} />
            </tr>
          </thead>
          <tbody>
            {displayed.map((v, i) => (
              <tr key={i} className={v.type === 'baseUrl' ? 'env-row-baseurl' : ''}>
                <td>
                  <input type="checkbox" checked={v.enabled !== false}
                    onChange={e => updateVars(i, 'enabled', e.target.checked)} />
                </td>
                <td>
                  <input
                    className="input env-input"
                    value={v.key}
                    onChange={e => updateVars(i, 'key', e.target.value)}
                    placeholder={v.type === 'baseUrl' ? 'baseUrl' : 'variable'}
                  />
                </td>
                <td>
                  <div className="env-value-wrap">
                    <input
                      className="input env-input"
                      type={v.type === 'secret' && !showSecret[i] ? 'password' : 'text'}
                      value={v.value}
                      onChange={e => updateVars(i, 'value', e.target.value)}
                      placeholder={v.type === 'baseUrl' ? 'https://api.example.com' : 'value'}
                    />
                    {v.type === 'secret' && v.key && (
                      <button className="env-toggle-secret btn btn-icon btn-ghost btn-sm"
                        onClick={() => setShowSecret(p => ({ ...p, [i]: !p[i] }))}>
                        {showSecret[i] ? '🙈' : '👁'}
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <select className="env-type-select" value={v.type || 'text'}
                    onChange={e => updateVars(i, 'type', e.target.value)}>
                    <option value="text">Text</option>
                    <option value="secret">Secret</option>
                    <option value="baseUrl">Base URL</option>
                  </select>
                </td>
                <td>
                  {v.key && (
                    <button className="btn btn-icon btn-ghost btn-sm" onClick={() => removeVar(i)}>
                      <X size={11} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Active preview ── */}
      {vars.filter(v => v.key && v.enabled !== false).length > 0 && (
        <div className="env-preview">
          <p className="env-preview-title">Active · {activeSet.name}</p>
          {vars.filter(v => v.key && v.enabled !== false).map((v, i) => (
            <div key={i} className={`env-preview-row ${v.type === 'baseUrl' ? 'env-preview-baseurl' : ''}`}>
              <span className="env-preview-key">{'{{' + v.key + '}}'}</span>
              <span className="env-preview-val">
                {v.type === 'secret' ? '••••••••' : (v.value || '(empty)')}
                {v.type === 'baseUrl' && <span className="env-baseurl-badge">Base URL</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
