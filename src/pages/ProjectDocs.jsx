import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useApp } from '../context/AppContext';
import { useDialog } from '../components/Dialog/Dialog';
import { getProjects, getRequests } from '../appwrite/database';
import { generateWithOpenAI } from '../ai/openai';
import {
  ArrowLeft, Sparkles, BookOpen, RefreshCw, Lock, Unlock,
  Globe, Loader2, Copy, Check, Download, ChevronRight,
  ChevronDown, ExternalLink, Zap,
} from 'lucide-react';
import './ProjectDocs.css';

const DOC_STORE_KEY = (projectId) => `nexus_project_doc_${projectId}`;

function loadProjectDoc(projectId) {
  try { return JSON.parse(localStorage.getItem(DOC_STORE_KEY(projectId)) || 'null'); } catch { return null; }
}
function saveProjectDoc(projectId, data) {
  localStorage.setItem(DOC_STORE_KEY(projectId), JSON.stringify(data));
}

// Build folder→requests structure from flat requests list
function buildFolderMap(requests) {
  const folders = {};
  const noFolder = [];
  for (const req of requests) {
    const f = req.folder || '';
    if (f) {
      if (!folders[f]) folders[f] = [];
      folders[f].push(req);
    } else {
      noFolder.push(req);
    }
  }
  return { folders, noFolder };
}

export default function ProjectDocs() {
  const { state } = useApp();
  const { toast } = useDialog();
  const navigate  = useNavigate();
  const isDark    = state.theme === 'dark';

  const [project, setProject]     = useState(null);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null); // { done, total, current }
  const [docData, setDocData]     = useState(null);  // { sections, generatedAt, password, isPublic }
  const [editMode, setEditMode]   = useState(false);
  const [password, setPassword]   = useState('');
  const [showPassPanel, setShowPassPanel] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [openFolders, setOpenFolders] = useState({});
  const scrollRef = useRef(null);
  const userId    = state.user?.$id;

  // ── Load project & requests ──────────────────────────────────────────────────
  useEffect(() => {
    if (!state.activeProjectId || !userId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getProjects(userId),
      getRequests(state.activeProjectId),
    ]).then(([projs, reqs]) => {
      setProject(projs.find(p => p.$id === state.activeProjectId) || null);
      setRequests(reqs);
      const stored = loadProjectDoc(state.activeProjectId);
      if (stored) {
        setDocData(stored);
        setPassword(stored.password || '');
        // Open all folders by default
        const fnames = Object.keys(buildFolderMap(reqs).folders);
        const opened = {};
        fnames.forEach(f => { opened[f] = true; });
        setOpenFolders(opened);
      }
    }).catch(e => toast('Failed to load: ' + e.message, 'error'))
      .finally(() => setLoading(false));
  }, [state.activeProjectId, userId]);

  // ── Generate full project documentation ─────────────────────────────────────
  async function generateDocs() {
    if (!requests.length) { toast('No requests in this project.', 'warning'); return; }
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!openaiKey) { toast('VITE_OPENAI_API_KEY not set in .env', 'error', 8000); return; }

    setGenerating(true);
    setGenProgress({ done: 0, total: requests.length, current: '' });

    const { folders, noFolder } = buildFolderMap(requests);
    const sections = [];
    const allGroups = [
      ...(noFolder.length ? [{ name: null, reqs: noFolder }] : []),
      ...Object.entries(folders).map(([name, reqs]) => ({ name, reqs })),
    ];

    for (const group of allGroups) {
      const groupSections = [];
      for (const req of group.reqs) {
        const label = req.name || `${req.method} ${req.url}`;
        setGenProgress(p => ({ ...p, current: label }));
        try {
          const prompt = buildSectionPrompt(req, project?.name || '');
          const content = await generateWithOpenAI(prompt);
          groupSections.push({ reqId: req.$id, name: label, method: req.method, url: req.url, content });
        } catch (e) {
          console.error('[ProjectDocs] Failed:', label, e.message);
          groupSections.push({ reqId: req.$id, name: label, method: req.method, url: req.url, content: `> ⚠️ Generation failed: ${e.message}` });
        }
        setGenProgress(p => ({ ...p, done: p.done + 1 }));
      }
      sections.push({ folder: group.name || null, requests: groupSections });
    }

    const newDoc = {
      sections,
      generatedAt: new Date().toISOString(),
      password: password || '',
      isPublic: true,
      projectId: state.activeProjectId,
      projectName: project?.name || '',
    };
    saveProjectDoc(state.activeProjectId, newDoc);
    setDocData(newDoc);
    setGenerating(false);
    setGenProgress(null);
    // Open all folders
    const opened = {};
    Object.keys(folders).forEach(f => { opened[f] = true; });
    setOpenFolders(opened);
    toast(`✓ Project documentation generated — ${requests.length} endpoints covered.`, 'success', 5000);
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportMarkdown() {
    if (!docData) return;
    const lines = [`# ${docData.projectName} — API Documentation\n\n_Generated: ${new Date(docData.generatedAt).toLocaleString()}_\n\n---\n`];
    for (const section of docData.sections) {
      if (section.folder) lines.push(`\n## 📁 ${section.folder}\n`);
      for (const req of section.requests) {
        lines.push(`\n### \`${req.method}\` ${req.name}\n\n${req.content}\n\n---`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${docData.projectName}_api_docs.md`; a.click();
    URL.revokeObjectURL(url);
    toast('Exported.', 'success');
  }

  // ── Copy public link ─────────────────────────────────────────────────────────
  async function copyLink() {
    const url = `${window.location.origin}/docs/project/${state.activeProjectId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── Save password/visibility ─────────────────────────────────────────────────
  function applyPassword(pw) {
    if (!docData) return;
    const updated = { ...docData, password: pw };
    saveProjectDoc(state.activeProjectId, updated);
    setDocData(updated);
    setShowPassPanel(false);
    toast(pw ? '🔒 Documentation protected.' : '🌐 Documentation set to public.', 'success');
  }

  // ── Update section content (inline edit) ─────────────────────────────────────
  function updateSectionContent(folderIdx, reqIdx, content) {
    const updated = { ...docData };
    updated.sections = [...docData.sections];
    updated.sections[folderIdx] = { ...updated.sections[folderIdx] };
    updated.sections[folderIdx].requests = [...updated.sections[folderIdx].requests];
    updated.sections[folderIdx].requests[reqIdx] = { ...updated.sections[folderIdx].requests[reqIdx], content };
    saveProjectDoc(state.activeProjectId, updated);
    setDocData(updated);
  }

  // ── Scroll to section ────────────────────────────────────────────────────────
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!state.activeProjectId) return (
    <div className="project-docs-page">
      <div className="empty-state" style={{ minHeight: '100vh' }}>
        <BookOpen size={48} />
        <p>Select a project from the sidebar first.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={13}/> Back
        </button>
      </div>
    </div>
  );

  const { folders, noFolder } = buildFolderMap(requests);
  const publicUrl = `${window.location.origin}/docs/project/${state.activeProjectId}`;

  return (
    <div className="project-docs-page">
      {/* ── Header ── */}
      <header className="pd-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={13}/> Back
        </button>
        <div className="pd-title">
          <BookOpen size={16} className="pd-title-icon" />
          <h1>{project?.name || 'Loading…'} — API Docs</h1>
          {docData && (
            <span className="pd-gen-time">
              Generated {new Date(docData.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="pd-actions">
          {docData && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPassPanel(!showPassPanel)}>
                {docData.password ? <><Lock size={13}/> Protected</> : <><Globe size={13}/> Public</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={copyLink}>
                {copied ? <><Check size={13}/> Copied!</> : <><Copy size={13}/> Copy Link</>}
              </button>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <ExternalLink size={13}/> Open
              </a>
              <button className="btn btn-ghost btn-sm" onClick={exportMarkdown}>
                <Download size={13}/> Export MD
              </button>
            </>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={generateDocs}
            disabled={generating || !requests.length || loading}>
            {generating
              ? <><Loader2 size={13} className="spin"/> {genProgress?.done}/{genProgress?.total}</>
              : <><Sparkles size={13}/> {docData ? 'Regenerate' : 'Generate Docs'}</>}
          </button>
        </div>
      </header>

      {/* ── Password panel ── */}
      {showPassPanel && (
        <div className="pd-pass-panel">
          <Lock size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
          <span style={{ fontSize: 12 }}>
            {docData?.password ? 'Password protected' : 'Public access'} — set a password to restrict access:
          </span>
          <input
            className="input"
            style={{ flex: 1, maxWidth: 320, fontSize: 13 }}
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Set password (leave blank for public)…"
          />
          <button className="btn btn-primary btn-sm" onClick={() => applyPassword(password)}>Apply</button>
          {docData?.password && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setPassword(''); applyPassword(''); }}>
              <Unlock size={13}/> Make Public
            </button>
          )}
        </div>
      )}

      {/* ── Generation progress ── */}
      {generating && genProgress && (
        <div className="pd-batch-bar">
          <div className="pd-batch-fill" style={{ width: `${Math.round((genProgress.done / genProgress.total) * 100)}%` }} />
          <span className="pd-batch-label">
            <Zap size={12} style={{ flexShrink: 0 }}/> {' '}
            {genProgress.current || 'Starting…'} ({genProgress.done}/{genProgress.total})
          </span>
        </div>
      )}

      {loading && (
        <div className="pd-loading-full">
          <Loader2 size={28} className="spin" />
          <p>Loading project…</p>
        </div>
      )}

      {!loading && !docData && !generating && (
        <div className="pd-no-doc">
          <BookOpen size={52} className="pd-no-doc-icon" />
          <h2>No documentation yet</h2>
          <p>Click <strong>Generate Docs</strong> to create a full project API reference with AI. The documentation will be organized by folder and include all {requests.length} endpoint{requests.length !== 1 ? 's' : ''}.</p>
          {requests.length > 0 && (
            <button className="btn btn-primary" onClick={generateDocs}>
              <Sparkles size={14}/> Generate Documentation
            </button>
          )}
          {requests.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Add requests to this project first.
            </p>
          )}

          {/* Folder preview */}
          {requests.length > 0 && (
            <div className="pd-folder-preview">
              <p className="pd-folder-preview-title">Will be organized as:</p>
              {noFolder.length > 0 && (
                <div className="pd-folder-chip">
                  <span>{noFolder.length} root endpoint{noFolder.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {Object.entries(folders).map(([name, reqs]) => (
                <div key={name} className="pd-folder-chip">
                  <span>📁 {name}</span>
                  <span className="pd-folder-chip-count">{reqs.length}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main doc layout ── */}
      {!loading && docData && (
        <div className="pd-layout">
          {/* Left: TOC */}
          <aside className="pd-toc">
            <div className="pd-toc-header">
              <span>Contents</span>
              <span className="pd-toc-count">{requests.length} endpoints</span>
            </div>
            <div className="pd-toc-scroll">
              {docData.sections.map((section, si) => (
                <div key={si} className="pd-toc-section">
                  {section.folder ? (
                    <button
                      className="pd-toc-folder"
                      onClick={() => setOpenFolders(p => ({ ...p, [section.folder]: !p[section.folder] }))}>
                      {openFolders[section.folder] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                      <span>📁 {section.folder}</span>
                      <span className="pd-toc-folder-count">{section.requests.length}</span>
                    </button>
                  ) : (
                    <div className="pd-toc-root-label">Root Endpoints</div>
                  )}
                  {(!section.folder || openFolders[section.folder]) && section.requests.map((req, ri) => (
                    <button
                      key={ri}
                      className="pd-toc-item"
                      onClick={() => scrollToId(`req-${si}-${ri}`)}>
                      <span className={`method-tag method-${req.method}`}>{req.method}</span>
                      <span className="pd-toc-item-name">{req.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Publish panel at bottom of TOC */}
            <div className="pd-toc-publish">
              <div className="pd-toc-publish-title">
                {docData.password
                  ? <><Lock size={11}/> Protected</>
                  : <><Globe size={11}/> Public</>}
              </div>
              <code className="pd-toc-url">{publicUrl}</code>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={copyLink}>
                {copied ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy Shareable Link</>}
              </button>
            </div>
          </aside>

          {/* Right: Full scrollable document */}
          <main className="pd-doc-main" ref={scrollRef}>
            <div className="pd-doc-body">
              <div className="pd-doc-intro">
                <h1>{docData.projectName} API Reference</h1>
                <p className="pd-doc-subtitle">
                  {requests.length} endpoints · {docData.sections.filter(s => s.folder).length} folders
                  {docData.password && <span className="pd-doc-badge protected"><Lock size={10}/> Password Protected</span>}
                  {!docData.password && <span className="pd-doc-badge public"><Globe size={10}/> Public</span>}
                </p>
                {project?.description && <p className="pd-doc-description">{project.description}</p>}
              </div>

              {docData.sections.map((section, si) => (
                <div key={si} className="pd-doc-section">
                  {section.folder && (
                    <div className="pd-doc-folder-header">
                      <span>📁</span>
                      <h2>{section.folder}</h2>
                      <span className="pd-doc-folder-count">{section.requests.length} endpoints</span>
                    </div>
                  )}
                  {section.requests.map((req, ri) => (
                    <div key={ri} id={`req-${si}-${ri}`} className="pd-doc-endpoint">
                      <div className="pd-doc-endpoint-header">
                        <span className={`method-tag method-${req.method}`}>{req.method}</span>
                        <code className="pd-doc-endpoint-url">{req.url}</code>
                        <span className="pd-doc-endpoint-name">{req.name}</span>
                        {editMode && (
                          <span className="pd-edit-badge">editing</span>
                        )}
                      </div>
                      {editMode ? (
                        <textarea
                          className="input pd-doc-textarea"
                          value={req.content}
                          onChange={e => updateSectionContent(si, ri, e.target.value)}
                          rows={20}
                        />
                      ) : (
                        <div className="pd-doc-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={isDark ? vscDarkPlus : oneLight}
                                    language={match[1]}
                                    PreTag="div" {...props}>
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : <code className={className} {...props}>{children}</code>;
                              }
                            }}>
                            {req.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              <div className="pd-doc-footer">
                <p>Generated by <strong>Nexus</strong> · {new Date(docData.generatedAt).toLocaleString()}</p>
                <div className="pd-doc-footer-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(!editMode)}>
                    {editMode ? '✓ Done Editing' : '✏️ Edit'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={generateDocs}>
                    <Sparkles size={12}/> Regenerate
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

// ── AI prompt for a single endpoint section ─────────────────────────────────
function buildSectionPrompt(req, projectName) {
  return `You are a technical writer generating API reference documentation for the project "${projectName}".

Generate a concise, well-structured Markdown section for this single endpoint:

**Method:** ${req.method}
**URL:** ${req.url}
**Name:** ${req.name || 'Unnamed'}
${req.description ? `**Description:** ${req.description}` : ''}
${req.headers?.filter(h => h.key)?.length ? `**Headers:** ${req.headers.filter(h => h.key).map(h => `${h.key}: ${h.value}`).join(', ')}` : ''}
${req.body ? `**Request Body:**\n\`\`\`json\n${req.body}\n\`\`\`` : ''}
${req.auth?.type && req.auth.type !== 'none' ? `**Auth:** ${req.auth.type}` : ''}

Include ONLY these sections (no heading for the endpoint itself — that will be added by the app):
- Brief description (1-2 sentences)
- Request Parameters table (if any)
- Request Body schema (if POST/PUT/PATCH)
- Response Example (realistic JSON)
- HTTP Status Codes table
- cURL Example

Keep it concise. Use proper Markdown tables and code blocks.`;
}
