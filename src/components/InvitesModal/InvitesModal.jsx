import React, { useState, useEffect, useCallback } from 'react';
import { getPendingInvites, acceptInvite, declineInvite } from '../../appwrite/database';
import { useDialog } from '../Dialog/Dialog';
import {
  X, Bell, Check, X as Decline, Loader2, FolderOpen, User,
} from 'lucide-react';
import './InvitesModal.css';

export default function InvitesModal({ user, onClose, onAccepted }) {
  const { toast } = useDialog();
  const [invites, setInvites]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null); // id of invite being acted on

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPendingInvites(user?.email);
      setInvites(list);
    } catch { setInvites([]); }
    finally { setLoading(false); }
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  async function handleAccept(invite) {
    setActing(invite.$id);
    try {
      await acceptInvite(invite.$id);
      setInvites(prev => prev.filter(i => i.$id !== invite.$id));
      toast(`You joined "${invite.projectName}" 🎉`, 'success', 4000);
      onAccepted?.(); // tell sidebar to reload projects
    } catch (e) {
      toast('Failed to accept: ' + e.message, 'error');
    } finally { setActing(null); }
  }

  async function handleDecline(invite) {
    setActing(invite.$id);
    try {
      await declineInvite(invite.$id);
      setInvites(prev => prev.filter(i => i.$id !== invite.$id));
      toast('Invitation declined.', 'success');
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
    } finally { setActing(null); }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal invites-modal">
        <div className="modal-header">
          <div className="invites-title">
            <Bell size={16} className="invites-bell" />
            <h3>Project Invitations</h3>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="invites-loading">
            <Loader2 size={20} className="spin" />
            <span>Loading invitations…</span>
          </div>
        ) : invites.length === 0 ? (
          <div className="invites-empty">
            <Bell size={32} strokeWidth={1.2} />
            <p>No pending invitations</p>
            <span>When someone invites you to a project, it will appear here.</span>
          </div>
        ) : (
          <div className="invites-list">
            {invites.map(invite => (
              <div key={invite.$id} className="invite-card">
                {/* Project info */}
                <div className="invite-card-left">
                  <div className="invite-project-icon">
                    <FolderOpen size={16} />
                  </div>
                  <div className="invite-info">
                    <div className="invite-project-name">{invite.projectName}</div>
                    {invite.projectDesc && (
                      <div className="invite-project-desc">{invite.projectDesc}</div>
                    )}
                    <div className="invite-from">
                      <User size={10} />
                      Invited by <strong>{invite.invitedByName || 'a team member'}</strong>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="invite-card-actions">
                  {acting === invite.$id ? (
                    <Loader2 size={16} className="spin" style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <>
                      <button
                        className="btn invite-decline-btn"
                        onClick={() => handleDecline(invite)}
                        title="Decline">
                        <Decline size={13} /> Decline
                      </button>
                      <button
                        className="btn invite-accept-btn"
                        onClick={() => handleAccept(invite)}
                        title="Accept">
                        <Check size={13} /> Accept
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && invites.length > 0 && (
          <p className="invites-hint">
            Accepting an invitation will add the project to your sidebar.
          </p>
        )}
      </div>
    </div>
  );
}
