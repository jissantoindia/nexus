import React, { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { getAppRelease } from '../../appwrite/database';
import './DownloadModal.css';

// ── Platform detection ──────────────────────────────────────────────────────
function detectOS() {
  const ua   = navigator.userAgent;
  const plat = (navigator.userAgentData?.platform || navigator.platform || '');
  if (/Mac|iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(plat))   return 'mac';
  if (/Win/i.test(ua) || /Win/i.test(plat))                     return 'windows';
  if (/Linux|Android/i.test(ua) || /Linux/i.test(plat))         return 'linux';
  return null;
}

// ── Fallback URLs (correct repo) ────────────────────────────────────────────
const FALLBACK = {
  windows: 'https://github.com/jissantoindia/nexus/releases/latest/download/Nexus-Setup-1.0.0.exe',
  mac:     'https://github.com/jissantoindia/nexus/releases/latest/download/Nexus-1.0.0-arm64.dmg',
  linux:   'https://github.com/jissantoindia/nexus/releases/latest/download/Nexus-1.0.0.AppImage',
};

const PLATFORM_INFO = {
  windows: { label: 'Windows', ext: '.exe',      note: 'Windows 10 / 11 — 64-bit' },
  mac:     { label: 'macOS',   ext: '.dmg',      note: 'macOS 12+ (Apple Silicon & Intel)' },
  linux:   { label: 'Linux',   ext: '.AppImage', note: 'AppImage · works on any distro' },
};

const PLATFORM_META = {
  windows: { color: '#00a4ef', bg: 'rgba(0,164,239,0.1)' },
  mac:     { color: '#a3aaae', bg: 'rgba(163,170,174,0.1)' },
  linux:   { color: '#fcc624', bg: 'rgba(252,198,36,0.1)' },
};

// ── SVG Platform Icons ───────────────────────────────────────────────────────
function WindowsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
    </svg>
  );
}
function MacIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
    </svg>
  );
}
function LinuxIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0C6.002 0 5.898 6.66 5.898 6.66c.138 3.154 2.28 3.851 2.28 3.851.085.064.17.1.248.126-.017.063-.04.11-.051.188-.068.43.03 2.02.03 2.02.185.85.61 1.09 1.35 1.09.43 0 .79-.065 1.09-.195.32.265.705.39 1.155.39.56 0 1.005-.195 1.35-.59.34.41.7.59 1.095.59.595 0 1.035-.275 1.32-.82.2-.38.275-.83.275-1.35V9.84s2.085-.14 2.085-3.58c0 0-.105-6.26-6.621-6.26z"/>
    </svg>
  );
}

const ICONS = { windows: WindowsIcon, mac: MacIcon, linux: LinuxIcon };

// ── Main Component ───────────────────────────────────────────────────────────
export default function DownloadModal({ onClose }) {
  const [os]      = useState(detectOS);
  const [urls,    setUrls]    = useState(FALLBACK);
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);

  // Load URLs from Appwrite admin-set release config
  useEffect(() => {
    getAppRelease().then(doc => {
      if (doc) {
        setUrls({
          windows: doc.win_url   || FALLBACK.windows,
          mac:     doc.mac_url   || FALLBACK.mac,
          linux:   doc.linux_url || FALLBACK.linux,
        });
        if (doc.version) setVersion(doc.version);
      }
    }).catch(() => { /* keep fallback */ }).finally(() => setLoading(false));
  }, []);

  const others = Object.keys(PLATFORM_INFO).filter(k => k !== os);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal download-modal">
        <div className="modal-header">
          <div className="download-modal-title">
            <Download size={16} className="download-icon" />
            <h3>Download Nexus Desktop{version ? ` v${version}` : ''}</h3>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <p className="download-subtitle">
          Use Nexus as a native desktop app — faster, offline-capable, and no browser tabs required.
        </p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 size={22} className="spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : (
          <>
            {/* Recommended platform */}
            {os && (
              <div className="download-primary-section">
                <div className="download-section-label">Recommended for your system</div>
                <PlatformCard platform={os} url={urls[os]} primary />
              </div>
            )}

            {/* All other platforms */}
            <div className="download-other-section">
              {os && <div className="download-section-label" style={{ marginBottom: 8 }}>Other platforms</div>}
              <div className="download-other-list">
                {(os ? others : Object.keys(PLATFORM_INFO)).map(p => (
                  <PlatformCard key={p} platform={p} url={urls[p]} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformCard({ platform, url, primary }) {
  const info = PLATFORM_INFO[platform];
  const meta = PLATFORM_META[platform];
  const Icon = ICONS[platform];

  return (
    <div className={`download-card ${primary ? 'download-card-primary' : ''}`}>
      <div className="download-card-left">
        <div className="download-platform-icon" style={{ background: meta.bg, color: meta.color }}>
          <Icon size={primary ? 24 : 20} />
        </div>
        <div className="download-card-info">
          <div className="download-platform-name">
            {info.label}
            <span className="download-ext-badge">{info.ext}</span>
          </div>
          <div className="download-platform-note">{info.note}</div>
        </div>
      </div>
      <a
        href={url}
        className={`btn ${primary ? 'btn-primary' : 'btn-secondary'} download-btn`}
        target="_blank"
        rel="noopener noreferrer">
        <Download size={13} />
        Download
      </a>
    </div>
  );
}
