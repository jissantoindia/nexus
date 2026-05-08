import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, ArrowUpCircle, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import './UpdateBanner.css';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const PLATFORM_LABEL = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

// ── States
const STATE = {
  IDLE:        'idle',        // update available, not started
  DOWNLOADING: 'downloading', // in progress
  READY:       'ready',       // downloaded, waiting for install
  ERROR:       'error',       // something went wrong
};

export default function UpdateBanner() {
  const { updateAvailable, release, platform, downloadUrl, dismissed, dismiss } = useUpdateCheck();

  const [dlState,   setDlState]   = useState(STATE.IDLE);
  const [progress,  setProgress]  = useState(0);        // 0-100
  const [transferred, setTransferred] = useState('0');  // e.g. "12.4"
  const [totalSize, setTotalSize] = useState('?');      // e.g. "86.2"
  const [errMsg,    setErrMsg]    = useState('');

  // ── Register Electron IPC listeners once
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const offProgress    = window.electronAPI.onUpdateProgress(({ percent, transferred: t, total }) => {
      setDlState(STATE.DOWNLOADING);
      setProgress(percent >= 0 ? percent : 0);
      setTransferred(t);
      setTotalSize(total);
    });

    const offDownloaded  = window.electronAPI.onUpdateDownloaded(() => {
      setDlState(STATE.READY);
      setProgress(100);
    });

    const offError       = window.electronAPI.onUpdateError(({ message }) => {
      setDlState(STATE.ERROR);
      setErrMsg(message || 'Download failed');
    });

    return () => {
      offProgress?.();
      offDownloaded?.();
      offError?.();
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!downloadUrl) return;

    if (isElectron) {
      // Background download via IPC
      setDlState(STATE.DOWNLOADING);
      setProgress(0);
      window.electronAPI.startUpdate(downloadUrl);
    } else {
      // Web: open download URL
      window.open(downloadUrl, '_blank', 'noopener');
    }
  }, [downloadUrl]);

  const handleInstall = useCallback(() => {
    if (isElectron) {
      window.electronAPI.installUpdate();
    }
  }, []);

  if (!updateAvailable || dismissed) return null;

  const platformLabel = platform ? PLATFORM_LABEL[platform] : '';

  return (
    <div className={`update-banner update-banner--${dlState}`} role="alert">

      {/* Left: status icon */}
      <div className="update-banner-icon">
        {dlState === STATE.READY  && <CheckCircle2  size={18} />}
        {dlState === STATE.ERROR  && <AlertCircle   size={18} />}
        {dlState === STATE.IDLE   && <ArrowUpCircle size={18} />}
        {dlState === STATE.DOWNLOADING && (
          <svg className="update-spinner" viewBox="0 0 24 24" width={18} height={18}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
              fill="none" strokeDasharray="32" strokeDashoffset="10" />
          </svg>
        )}
      </div>

      {/* Centre: text + progress */}
      <div className="update-banner-body">
        {dlState === STATE.IDLE && (
          <>
            <div className="update-banner-title">
              Nexus <span className="update-tag">v{release.version}</span> is available
            </div>
            {release.release_notes && (
              <div className="update-banner-notes">{release.release_notes}</div>
            )}
          </>
        )}

        {dlState === STATE.DOWNLOADING && (
          <>
            <div className="update-banner-title">
              Downloading update… <span className="update-tag">{progress}%</span>
            </div>
            <div className="update-progress-track">
              <div className="update-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="update-banner-notes">
              {transferred} MB of {totalSize} MB
            </div>
          </>
        )}

        {dlState === STATE.READY && (
          <>
            <div className="update-banner-title">
              Ready to install <span className="update-tag">v{release.version}</span>
            </div>
            <div className="update-banner-notes">
              {isElectron
                ? 'The update has been downloaded. Nexus will restart to apply it.'
                : 'Download complete.'}
            </div>
          </>
        )}

        {dlState === STATE.ERROR && (
          <>
            <div className="update-banner-title update-banner-title--error">
              Update failed
            </div>
            <div className="update-banner-notes">{errMsg}</div>
          </>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="update-banner-actions">
        {dlState === STATE.IDLE && (
          <button className="btn update-action-btn update-action-btn--primary" onClick={handleUpdate}>
            <Download size={13} />
            {isElectron
              ? `Update${platformLabel ? ` for ${platformLabel}` : ''}`
              : `Download${platformLabel ? ` for ${platformLabel}` : ''}`}
          </button>
        )}

        {dlState === STATE.DOWNLOADING && (
          <div className="update-pct-pill">{progress}%</div>
        )}

        {dlState === STATE.READY && isElectron && (
          <button className="btn update-action-btn update-action-btn--primary" onClick={handleInstall}>
            <RotateCcw size={13} />
            Restart &amp; Install
          </button>
        )}

        {dlState === STATE.ERROR && (
          <button className="btn update-action-btn update-action-btn--ghost"
            onClick={() => { setDlState(STATE.IDLE); setErrMsg(''); }}>
            Try again
          </button>
        )}
      </div>

      {/* Dismiss — only when idle or error */}
      {(dlState === STATE.IDLE || dlState === STATE.ERROR) && (
        <button className="update-dismiss" onClick={dismiss} title="Dismiss">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
