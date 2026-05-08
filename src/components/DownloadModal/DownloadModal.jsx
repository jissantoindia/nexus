import React, { useState } from 'react';
import { X, Download, Monitor } from 'lucide-react';
import './DownloadModal.css';

// ── Platform detection ──────────────────────────────────────────────────────
function detectOS() {
  const ua  = navigator.userAgent.toLowerCase();
  const plat = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  if (ua.includes('win') || plat.includes('win'))   return 'windows';
  if (ua.includes('mac') || plat.includes('mac'))   return 'mac';
  if (ua.includes('linux') || plat.includes('linux')) return 'linux';
  return null; // unknown
}

// ── Release links — update these when desktop builds are published ──────────
const RELEASES = {
  windows: {
    label:     'Windows',
    ext:       '.exe',
    url:       'https://github.com/eduzere/nexus/releases/latest/download/Nexus-Setup.exe',
    secondary: 'https://github.com/eduzere/nexus/releases',
    note:      'Windows 10 / 11 — 64-bit',
  },
  mac: {
    label:     'macOS',
    ext:       '.dmg',
    url:       'https://github.com/eduzere/nexus/releases/latest/download/Nexus.dmg',
    secondary: 'https://github.com/eduzere/nexus/releases',
    note:      'macOS 12+ (Apple Silicon & Intel)',
  },
  linux: {
    label:     'Linux',
    ext:       '.AppImage',
    url:       'https://github.com/eduzere/nexus/releases/latest/download/Nexus.AppImage',
    secondary: 'https://github.com/eduzere/nexus/releases',
    note:      'AppImage · works on any distro',
  },
};

// ── SVG platform icons ──────────────────────────────────────────────────────
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
      <path d="M12.504 0C6.002 0 5.898 6.66 5.898 6.66c.138 3.154 2.28 3.851 2.28 3.851.085.064.17.1.248.126-.017.063-.04.11-.051.188-.068.43.03 2.02.03 2.02.185.85.61 1.09 1.35 1.09.43 0 .79-.065 1.09-.195.32.265.705.39 1.155.39.56 0 1.005-.195 1.35-.59.34.41.7.59 1.095.59.595 0 1.035-.275 1.32-.82.2-.38.275-.83.275-1.35V9.84s2.085-.14 2.085-3.58c0 0-.105-6.26-6.621-6.26zM9.88 5.5c-.295.005-.555.095-.765.265-.315.24-.48.61-.48 1.055 0 .78.455 1.365 1.35 1.365.47 0 .845-.16 1.12-.47.295-.34.43-.8.43-1.37 0-.97-.435-1.45-1.655-.845zm4.31 0c-1.26-.605-1.655-.125-1.655.845 0 .57.135 1.03.43 1.37.275.31.65.47 1.12.47.895 0 1.35-.585 1.35-1.365 0-.445-.165-.815-.48-1.055-.21-.17-.47-.26-.765-.265zM7.51 12.35c-.2.01-.38.04-.565.07-.38.065-.725.185-1.04.36-.78.435-1.25 1.155-1.41 2.16-.035.195-.05.4-.05.6v.545c0 .315.025.615.075.91l.23 1.24.005.025c.11.6.165 1.21.165 1.82 0 .535-.01 1.015-.035 1.44-.065 1.215-.385 1.815-.385 1.815s-.44.475-.44.93c0 .405.345.69.73.69.455 0 .67-.26.83-.485.21-.31.405-.64.58-.98.2-.38.38-.745.53-1.11.195-.495.32-1.015.36-1.555.015-.21.025-.415.025-.625v-.57c0-.585-.025-1.165-.07-1.74-.055-.67-.165-1.33-.33-1.99-.085-.345-.09-.52-.03-.6.035-.05.12-.08.26-.08.375 0 .87.185.87.185l.44-.805s-.625-.295-1.32-.295c-.05 0-.095 0-.145.005zm9.255 0c-.695 0-1.32.295-1.32.295l.44.805s.495-.185.87-.185c.14 0 .225.03.26.08.06.08.055.255-.03.6-.165.66-.275 1.32-.33 1.99-.045.575-.07 1.155-.07 1.74v.57c0 .21.01.415.025.625.04.54.165 1.06.36 1.555.15.365.33.73.53 1.11.175.34.37.67.58.98.16.225.375.485.83.485.385 0 .73-.285.73-.69 0-.455-.44-.93-.44-.93s-.32-.6-.385-1.815c-.025-.425-.035-.905-.035-1.44 0-.61.055-1.22.165-1.82l.005-.025.23-1.24c.05-.295.075-.595.075-.91v-.545c0-.2-.015-.405-.05-.6-.16-1.005-.63-1.725-1.41-2.16-.315-.175-.66-.295-1.04-.36-.185-.03-.365-.06-.565-.07z"/>
    </svg>
  );
}

const PLATFORM_META = {
  windows: { Icon: WindowsIcon, color: '#00a4ef', bg: 'rgba(0,164,239,0.1)' },
  mac:     { Icon: MacIcon,     color: '#a3aaae', bg: 'rgba(163,170,174,0.1)' },
  linux:   { Icon: LinuxIcon,   color: '#fcc624', bg: 'rgba(252,198,36,0.1)' },
};

export default function DownloadModal({ onClose }) {
  const [os] = useState(detectOS);

  const others = Object.keys(RELEASES).filter(k => k !== os);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal download-modal">
        <div className="modal-header">
          <div className="download-modal-title">
            <Download size={16} className="download-icon" />
            <h3>Download Nexus Desktop</h3>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <p className="download-subtitle">
          Use Nexus as a native desktop app — faster, offline-capable, and no browser tabs required.
        </p>

        {/* Detected / recommended platform — highlighted */}
        {os && (
          <div className="download-primary-section">
            <div className="download-section-label">Recommended for your system</div>
            <PlatformCard platform={os} primary />
          </div>
        )}

        {/* All other platforms — always visible */}
        <div className="download-other-section">
          {os && <div className="download-section-label" style={{ marginBottom: 8 }}>Other platforms</div>}
          <div className="download-other-list">
            {/* If OS unknown, show all; otherwise show the remaining two */}
            {(os ? others : Object.keys(RELEASES)).map(p => (
              <PlatformCard key={p} platform={p} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function PlatformCard({ platform, primary }) {
  const info = RELEASES[platform];
  const meta = PLATFORM_META[platform];
  const { Icon } = meta;

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
        href={info.url}
        className={`btn ${primary ? 'btn-primary' : 'btn-secondary'} download-btn`}
        target="_blank"
        rel="noopener noreferrer">
        <Download size={13} />
        Download
      </a>
    </div>
  );
}
