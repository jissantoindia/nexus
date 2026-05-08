import React, { useState } from 'react';
import nexusLogo from '/flash.png';

import { useApp } from '../../context/AppContext';
import { changePassword } from '../../appwrite/database';
import { useDialog } from '../Dialog/Dialog';
import { CURRENT_VERSION } from '../../hooks/useUpdateCheck';
import {
  X, Moon, Sun, KeyRound, Eye, EyeOff, Loader2,
  MousePointerClick, Palette, User, Lock, Info,
  ChevronRight,
} from 'lucide-react';
import './SettingsModal.css';

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account',    label: 'Account',    icon: User    },
  { id: 'security',   label: 'Security',   icon: Lock    },
  { id: 'about',      label: 'About',      icon: Info    },
];

export default function SettingsModal({ onClose }) {
  const { state, dispatch } = useApp();
  const { toast } = useDialog();
  const [activeTab, setActiveTab] = useState('appearance');

  const [oldPass,   setOldPass]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [confPass,  setConfPass]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPass !== confPass) { toast('New passwords do not match.', 'error'); return; }
    if (newPass.length < 8)   { toast('Password must be at least 8 characters.', 'error'); return; }
    setPwLoading(true);
    try {
      await changePassword(oldPass, newPass);
      toast('Password changed successfully.', 'success');
      setOldPass(''); setNewPass(''); setConfPass('');
    } catch (e) {
      toast('Failed: ' + (e.message || 'Incorrect current password.'), 'error', 6000);
    } finally { setPwLoading(false); }
  }

  const user = state.user;

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-dialog">

        {/* ── Left nav ── */}
        <nav className="settings-nav">
          <div className="settings-nav-header">
            <span className="settings-nav-title">Settings</span>
          </div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <ChevronRight size={12} className="settings-nav-chevron" />
              </button>
            );
          })}
        </nav>

        {/* ── Right pane ── */}
        <div className="settings-pane">
          <div className="settings-pane-header">
            <h2 className="settings-pane-title">{TABS.find(t => t.id === activeTab)?.label}</h2>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="settings-pane-body">

            {/* ── Appearance ── */}
            {activeTab === 'appearance' && (
              <div className="settings-content">
                <div className="settings-group">
                  <div className="settings-group-label">Theme</div>
                  <div className="settings-row">
                    <div className="settings-row-left">
                      <span className="settings-row-title">Color theme</span>
                      <span className="settings-row-desc">Choose between dark and light interface</span>
                    </div>
                    <div className="settings-theme-btns">
                      <button
                        className={`settings-theme-btn ${state.theme === 'dark' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_THEME', payload: 'dark' })}>
                        <Moon size={13} /> Dark
                      </button>
                      <button
                        className={`settings-theme-btn ${state.theme === 'light' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_THEME', payload: 'light' })}>
                        <Sun size={13} /> Light
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-group-label">Interface</div>
                  <div className="settings-row">
                    <div className="settings-row-left">
                      <span className="settings-row-title">Icon tooltips</span>
                      <span className="settings-row-desc">Show labels when hovering icon buttons</span>
                    </div>
                    <label className="settings-switch">
                      <input
                        type="checkbox"
                        checked={!!state.showTooltips}
                        onChange={e => dispatch({ type: 'SET_TOOLTIPS', payload: e.target.checked })}
                      />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── Account ── */}
            {activeTab === 'account' && (
              <div className="settings-content">
                {/* Single profile card — name shown only here */}
                {user && (
                  <div className="settings-profile-card">
                    <div className="settings-profile-avatar">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="settings-profile-info">
                      <div className="settings-profile-name">{user.name}</div>
                      <div className="settings-profile-email">{user.email}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Security ── */}
            {activeTab === 'security' && (
              <div className="settings-content">
                <div className="settings-group">
                  <div className="settings-group-label">Change Password</div>
                  <form className="settings-pw-form" onSubmit={handlePasswordChange}>
                    <div className="settings-pw-field">
                      <label className="settings-input-label">Current password</label>
                      <div className="settings-input-wrap">
                        <input
                          className="input"
                          type={showPw ? 'text' : 'password'}
                          placeholder="Enter current password"
                          value={oldPass}
                          onChange={e => setOldPass(e.target.value)}
                          required
                        />
                        <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}>
                          {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <div className="settings-pw-field">
                      <label className="settings-input-label">New password</label>
                      <input className="input" type={showPw ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={8} />
                    </div>
                    <div className="settings-pw-field">
                      <label className="settings-input-label">Confirm new password</label>
                      <input className="input" type={showPw ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={confPass} onChange={e => setConfPass(e.target.value)} required />
                    </div>
                    <button className="btn btn-primary settings-save-btn" type="submit" disabled={pwLoading}>
                      {pwLoading
                        ? <><Loader2 size={13} className="spin" /> Updating…</>
                        : <><KeyRound size={13} /> Update Password</>}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── About ── */}
            {activeTab === 'about' && (
              <div className="settings-content">
                <div className="settings-about-hero">
                  <img src={nexusLogo} className="settings-about-logo" alt="Nexus" />
                  <div className="settings-about-name">Nexus</div>
                  <div className="settings-about-tagline">API Testing &amp; Documentation Platform</div>
                  <div className="settings-about-version">Version {CURRENT_VERSION}</div>
                </div>

                <div className="settings-group">
                  <div className="settings-group-label">Details</div>
                  <div className="settings-kv-list">
                    <div className="settings-kv-row"><span>Version</span><span className="settings-mono">v{CURRENT_VERSION}</span></div>
                    <div className="settings-kv-row"><span>Copyright</span><span>© {new Date().getFullYear()} Eduzere</span></div>
                    <div className="settings-kv-row"><span>License</span><span>Proprietary</span></div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
