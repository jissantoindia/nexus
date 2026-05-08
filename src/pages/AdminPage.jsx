import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListUsers, adminCreateUser,
  adminDeleteUser, adminToggleUserStatus,
} from '../appwrite/adminClient';
import { getAppRelease, saveAppRelease } from '../appwrite/database';
import { useDialog } from '../components/Dialog/Dialog';
import {
  ArrowLeft, Plus, Trash2, UserCheck, UserX,
  Loader2, Shield, RefreshCw, X, AlertTriangle, Package, Save,
} from 'lucide-react';
import './AdminPage.css';

const ADMIN_KEY = import.meta.env.VITE_APPWRITE_ADMIN_KEY;

export default function AdminPage() {
  const { toast, confirm } = useDialog();
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass]   = useState('');
  const [creating, setCreating] = useState(false);

  // ── Release management state ──────────────────────────────────────────────
  const [showRelease, setShowRelease]       = useState(false);
  const [release, setRelease]               = useState({ version: '', win_url: '', mac_url: '', linux_url: '', release_notes: '' });
  const [releaseLoading, setReleaseLoading] = useState(true);
  const [releaseSaving, setReleaseSaving]   = useState(false);

  const keyMissing = !ADMIN_KEY;

  async function loadUsers() {
    if (keyMissing) return;
    setLoading(true);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } catch (e) {
      toast('Failed to load users: ' + e.message, 'error', 6000);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadUsers();
    getAppRelease().then(doc => {
      if (doc) setRelease({
        version:       doc.version       || '',
        win_url:       doc.win_url       || '',
        mac_url:       doc.mac_url       || '',
        linux_url:     doc.linux_url     || '',
        release_notes: doc.release_notes || '',
      });
      setReleaseLoading(false);
    }).catch(() => setReleaseLoading(false));
  }, []);

  async function handleSaveRelease(e) {
    e.preventDefault();
    if (!release.version.trim()) { toast('Version is required.', 'warning'); return; }
    setReleaseSaving(true);
    try {
      await saveAppRelease(release);
      toast('Release published! Users will see the update prompt.', 'success');
      setShowRelease(false);
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error');
    } finally {
      setReleaseSaving(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await adminCreateUser(newEmail, newPass, newName);
      toast(`User "${newName}" created successfully.`, 'success');
      setNewName(''); setNewEmail(''); setNewPass('');
      setShowCreate(false);
      loadUsers();
    } catch (e) { toast('Create failed: ' + e.message, 'error'); }
    finally { setCreating(false); }
  }

  async function handleDelete(user) {
    const ok = await confirm({
      title: 'Delete User',
      message: `"${user.name}" (${user.email}) will be permanently removed and lose all access.`,
      confirmLabel: 'Delete User', cancelLabel: 'Cancel', variant: 'danger',
    });
    if (!ok) return;
    try {
      await adminDeleteUser(user.$id);
      toast(`User "${user.name}" deleted.`, 'success');
      setUsers(prev => prev.filter(u => u.$id !== user.$id));
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }

  async function handleToggle(user) {
    try {
      await adminToggleUserStatus(user.$id, user.status);
      toast(`User "${user.name}" ${user.status ? 'blocked' : 'unblocked'}.`, 'success');
      loadUsers();
    } catch (e) { toast('Status update failed: ' + e.message, 'error'); }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> Workspace</Link>
        <div className="admin-title"><Shield size={16} /><h1>Admin Panel</h1></div>
        <div className="admin-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowRelease(true)}
            title="Manage app releases"
          >
            <Package size={13} /> Release Manager
          </button>
          {!keyMissing && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers} disabled={loading}><RefreshCw size={13} /></button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}><Plus size={13} /> Add User</button>
            </>
          )}
        </div>
      </header>

      {/* Missing key warning */}
      {keyMissing && (
        <div className="admin-key-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>Admin API key not configured.</strong>
            <p>Add <code>VITE_APPWRITE_ADMIN_KEY</code> to your <code>.env</code> file with your Appwrite server API key, then restart the dev server.</p>
            <pre className="admin-key-hint">VITE_APPWRITE_ADMIN_KEY=standard_xxxxxxxxxxxx…</pre>
          </div>
        </div>
      )}

      {/* Create user form */}
      {!keyMissing && showCreate && (
        <div className="admin-create-bar">
          <form className="admin-create-form" onSubmit={handleCreate}>
            <input className="input" placeholder="Full name" value={newName}
              onChange={e => setNewName(e.target.value)} required />
            <input className="input" type="email" placeholder="Email address" value={newEmail}
              onChange={e => setNewEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Password (8+ chars)" value={newPass}
              onChange={e => setNewPass(e.target.value)} required minLength={8} />
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><X size={14} /></button>
          </form>
        </div>
      )}

      {/* Users table */}
      {!keyMissing && (
        <div className="admin-content">
          {loading && (
            <div className="admin-loading"><Loader2 size={24} className="spin" /><p>Loading users…</p></div>
          )}
          {!loading && users.length === 0 && (
            <div className="empty-state" style={{ minHeight: 300 }}>
              <Shield size={40} />
              <p>No users found. Add one using the button above.</p>
            </div>
          )}
          {!loading && users.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Labels</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.$id} className={!user.status ? 'user-blocked' : ''}>
                    <td>
                      <div className="user-cell">
                        <div className="user-cell-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td className="user-email-cell">{user.email}</td>
                    <td>
                      <div className="label-list">
                        {(user.labels || []).map(l => <span key={l} className="user-label">{l}</span>)}
                        {(user.labels || []).length === 0 && <span className="user-label-none">user</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status ? 'active' : 'blocked'}`}>
                        {user.status ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td>
                      <div className="user-action-btns">
                        <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(user)}>
                          {user.status ? <><UserX size={13} /> Block</> : <><UserCheck size={13} /> Unblock</>}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="admin-footer">
        <p>User management uses your Appwrite server API key stored in <code>VITE_APPWRITE_ADMIN_KEY</code>.</p>
      </div>

      {/* ── Release Manager Popup ── */}
      {showRelease && (
        <div className="release-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowRelease(false); }}>
          <div className="release-modal">
            {/* Header */}
            <div className="release-modal-header">
              <div className="release-modal-title">
                <div className="release-modal-icon"><Package size={18} /></div>
                <div>
                  <h2>App Release Manager</h2>
                  <p>Publish a new version — all running instances will show an update prompt.</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon release-modal-close" onClick={() => setShowRelease(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="release-modal-body">
              {releaseLoading ? (
                <div className="admin-loading"><Loader2 size={24} className="spin" /><p>Loading…</p></div>
              ) : (
                <form id="release-form" onSubmit={handleSaveRelease}>
                  {/* Version */}
                  <div className="rm-field">
                    <label className="rm-label">
                      Version Number <span className="rm-required">*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="e.g.  1.4.0"
                      value={release.version}
                      onChange={e => setRelease(r => ({ ...r, version: e.target.value }))}
                      required
                    />
                    <span className="rm-hint">Users on older versions will see an update banner.</span>
                  </div>

                  {/* Download URLs */}
                  <div className="rm-url-grid">
                    <div className="rm-field">
                      <label className="rm-label">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" style={{color:'#00a4ef'}}>
                          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                        </svg>
                        Windows (.exe)
                      </label>
                      <input className="input" type="url" placeholder="https://…/Nexus-Setup.exe"
                        value={release.win_url}
                        onChange={e => setRelease(r => ({ ...r, win_url: e.target.value }))} />
                    </div>

                    <div className="rm-field">
                      <label className="rm-label">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" style={{color:'#a3aaae'}}>
                          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                        </svg>
                        macOS (.dmg)
                      </label>
                      <input className="input" type="url" placeholder="https://…/Nexus.dmg"
                        value={release.mac_url}
                        onChange={e => setRelease(r => ({ ...r, mac_url: e.target.value }))} />
                    </div>

                    <div className="rm-field">
                      <label className="rm-label">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" style={{color:'#fcc624'}}>
                          <path d="M12.504 0C6.002 0 5.898 6.66 5.898 6.66c.138 3.154 2.28 3.851 2.28 3.851.085.064.17.1.248.126-.017.063-.04.11-.051.188-.068.43.03 2.02.03 2.02.185.85.61 1.09 1.35 1.09.43 0 .79-.065 1.09-.195.32.265.705.39 1.155.39.56 0 1.005-.195 1.35-.59.34.41.7.59 1.095.59.595 0 1.035-.275 1.32-.82.2-.38.275-.83.275-1.35V9.84s2.085-.14 2.085-3.58c0 0-.105-6.26-6.621-6.26z"/>
                        </svg>
                        Linux (.AppImage)
                      </label>
                      <input className="input" type="url" placeholder="https://…/Nexus.AppImage"
                        value={release.linux_url}
                        onChange={e => setRelease(r => ({ ...r, linux_url: e.target.value }))} />
                    </div>
                  </div>

                  {/* Release notes */}
                  <div className="rm-field">
                    <label className="rm-label">
                      Release Notes
                      <span className="rm-optional">(shown in the update banner)</span>
                    </label>
                    <textarea
                      className="input rm-notes"
                      placeholder="What's new in this version? Bug fixes, new features…"
                      value={release.release_notes}
                      onChange={e => setRelease(r => ({ ...r, release_notes: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            {!releaseLoading && (
              <div className="release-modal-footer">
                <span className="rm-hint">After saving, all app users will see the update notification.</span>
                <div className="release-modal-btns">
                  <button className="btn btn-ghost" onClick={() => setShowRelease(false)}>Cancel</button>
                  <button className="btn btn-primary" type="submit" form="release-form" disabled={releaseSaving}>
                    {releaseSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                    {releaseSaving ? 'Publishing…' : 'Publish Release'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
