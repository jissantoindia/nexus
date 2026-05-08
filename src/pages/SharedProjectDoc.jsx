import React, { useState, useEffect } from 'react';
import nexusLogo from '/flash.png';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getRequests } from '../appwrite/database';
import { Lock, Zap, ChevronRight, ChevronDown, Globe, ArrowLeft, Send, Loader2 } from 'lucide-react';
import './SharedDoc.css';

const DOC_STORE_KEY = (id) => `nexus_project_doc_${id}`;

export default function SharedProjectDoc() {
  const { projectId } = useParams();
  const [doc, setDoc]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked]     = useState(false);
  const [openFolders, setOpenFolders] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [tryResult, setTryResult]   = useState(null);
  const [tryLoading, setTryLoading] = useState(false);
  const [authKey, setAuthKey]       = useState('');

  useEffect(() => {
    if (!projectId) { setError('No project ID in URL.'); setLoading(false); return; }

    // First try localStorage (same-browser, no login needed for public docs)
    const stored = localStorage.getItem(DOC_STORE_KEY(projectId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDoc(parsed);
        if (!parsed.password) setUnlocked(true);
        // Open all folders by default
        const folders = {};
        (parsed.sections || []).forEach(s => { if (s.folder) folders[s.folder] = true; });
        setOpenFolders(folders);
        setLoading(false);
        return;
      } catch {}
    }

    // Fallback: try to build doc from Appwrite requests
    // (handles case where doc was generated on another device — show basic info)
    getRequests(projectId)
      .then(reqs => {
        if (!reqs || reqs.length === 0) {
          setError('Project documentation not found. Generate it from the app first.');
          return;
        }
        // Build minimal doc from raw requests
        const folders = {};
        const noFolder = [];
        reqs.forEach(r => {
          const f = r.folder || '';
          if (f) { if (!folders[f]) folders[f] = []; folders[f].push(r); }
          else noFolder.push(r);
        });
        const sections = [
          ...(noFolder.length ? [{ folder: null, requests: noFolder.map(r => ({ ...r, content: r.description || '*No documentation generated yet. Open the app and click Generate Docs.*' })) }] : []),
          ...Object.entries(folders).map(([name, reqs]) => ({
            folder: name,
            requests: reqs.map(r => ({ ...r, name: r.name || `${r.method} ${r.url}`, content: r.description || '*No documentation generated yet. Open the app and click Generate Docs.*' })),
          })),
        ];
        const fallback = { sections, projectName: 'API Documentation', generatedAt: new Date().toISOString(), password: '', isPublic: true };
        setDoc(fallback);
        setUnlocked(true);
        const folderMap = {};
        Object.keys(folders).forEach(f => { folderMap[f] = true; });
        setOpenFolders(folderMap);
      })
      .catch(() => setError('Project documentation not found or not accessible.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  function checkPassword() {
    if (passwordInput === doc.password) {
      setUnlocked(true);
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2800);
    }
  }

  async function tryEndpoint(req) {
    setActiveSection(req.$id || req.reqId);
    setTryResult(null); setTryLoading(true);
    const headers = {};
    if (authKey) headers['Authorization'] = `Bearer ${authKey}`;
    if (req.headers?.filter) req.headers.filter(h => h.key && h.enabled !== false).forEach(h => { headers[h.key] = h.value; });
    try {
      const start = Date.now();
      const res = await fetch(req.url, { method: req.method || 'GET', headers });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      setTryResult({ status: res.status, time: Date.now() - start, data });
    } catch (e) { setTryResult({ error: e.message }); }
    finally { setTryLoading(false); }
  }

  if (loading) return (
    <div className="shared-doc-page">
      <div className="sd-loading"><div className="spin sd-spinner" /><p>Loading documentation…</p></div>
    </div>
  );

  if (error) return (
    <div className="shared-doc-page">
      <div className="sd-error">
        <img src={nexusLogo} style={{ width: 36, height: 36, marginBottom: 12, borderRadius: 8 }} alt="Nexus" />
        <p>{error}</p>
        <Link to="/" className="btn btn-ghost"><ArrowLeft size={14}/> Open Nexus</Link>
      </div>
    </div>
  );

  if (!unlocked) return (
    <div className="shared-doc-page">
      <div className="sd-password-gate">
        <div className="sd-pw-card glass">
          <div className="sd-pw-icon"><Lock size={24} /></div>
          <h2>Protected Documentation</h2>
          <p>This API documentation is password protected.</p>
          <input className={`input ${passwordError ? 'input-error' : ''}`} type="password"
            placeholder="Enter password…" value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
            onKeyDown={e => e.key === 'Enter' && checkPassword()} />
          {passwordError && <p className="sd-pw-error">Incorrect password. Please try again.</p>}
          <button className="btn btn-primary" onClick={checkPassword}>Unlock</button>
        </div>
      </div>
    </div>
  );

  const allRequests = doc.sections?.flatMap(s => s.requests) || [];

  return (
    <div className="shared-doc-page spd-page">
      {/* Header */}
      <header className="sd-header">
        <div className="sd-header-inner">
          <div className="sd-logo"><img src={nexusLogo} className="sd-logo-img" alt="Nexus" /> Nexus</div>
          <div className="spd-project-title">
            <h1>{doc.projectName || 'API Documentation'}</h1>
            {!doc.password
              ? <span className="spd-badge public"><Globe size={10}/> Public</span>
              : <span className="spd-badge protected"><Lock size={10}/> Protected</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="spd-meta">{allRequests.length} endpoints</span>
            <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={13}/> Open App</Link>
          </div>
        </div>
      </header>

      <div className="spd-layout">
        {/* TOC sidebar */}
        <aside className="spd-toc">
          <div className="spd-toc-title">Contents</div>
          {doc.sections?.map((section, si) => (
            <div key={si} className="spd-toc-section">
              {section.folder ? (
                <button
                  className="spd-toc-folder"
                  onClick={() => setOpenFolders(p => ({ ...p, [section.folder]: !p[section.folder] }))}>
                  {openFolders[section.folder] ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                  <span>📁 {section.folder}</span>
                  <span className="spd-toc-count">{section.requests.length}</span>
                </button>
              ) : (
                <div className="spd-toc-root">Root</div>
              )}
              {(!section.folder || openFolders[section.folder]) && section.requests.map((req, ri) => (
                <a key={ri} href={`#req-${si}-${ri}`} className="spd-toc-item">
                  <span className={`method-tag method-${req.method}`}>{req.method}</span>
                  <span className="spd-toc-name">{req.name}</span>
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="spd-main">
          <div className="spd-doc-body">
            {/* Intro */}
            <div className="spd-intro">
              <h1>{doc.projectName} API Reference</h1>
              <p className="spd-subtitle">
                {allRequests.length} endpoints ·{' '}
                Generated {new Date(doc.generatedAt).toLocaleDateString()}
              </p>
              <p className="spd-tip">
                💡 Click <strong>Try It</strong> on any endpoint to test it live from this page.
              </p>
            </div>

            {/* Sections */}
            {doc.sections?.map((section, si) => (
              <div key={si} className="spd-section">
                {section.folder && (
                  <div className="spd-folder-header">
                    <span>📁</span>
                    <h2>{section.folder}</h2>
                    <span className="spd-folder-count">{section.requests.length}</span>
                  </div>
                )}
                {section.requests.map((req, ri) => {
                  const id = `req-${si}-${ri}`;
                  const isActive = activeSection === (req.$id || req.reqId);
                  return (
                    <div key={ri} id={id} className={`spd-endpoint ${isActive ? 'spd-endpoint-active' : ''}`}>
                      <div className="spd-endpoint-header">
                        <span className={`method-tag method-${req.method}`}>{req.method}</span>
                        <code className="spd-endpoint-url">{req.url}</code>
                        <span className="spd-endpoint-name">{req.name}</span>
                        <button className="btn btn-primary btn-sm spd-try-btn" onClick={() => tryEndpoint(req)}>
                          {tryLoading && isActive ? <Loader2 size={11} className="spin"/> : <Send size={11}/>}
                          {' '}Try It
                        </button>
                      </div>

                      {/* Live try result */}
                      {isActive && tryResult && (
                        <div className="spd-try-result">
                          {tryResult.error
                            ? <p className="sd-try-error">⚠ {tryResult.error}</p>
                            : <>
                                <div className="spd-try-meta">
                                  <span style={{ color: tryResult.status < 300 ? '#22d3a0' : tryResult.status < 500 ? '#f97316' : '#ef4444', fontWeight: 700 }}>
                                    {tryResult.status}
                                  </span>
                                  <span className="rv-meta">{tryResult.time}ms</span>
                                  <input
                                    className="input spd-auth-input"
                                    value={authKey}
                                    onChange={e => setAuthKey(e.target.value)}
                                    placeholder="Bearer token (optional)…"
                                  />
                                </div>
                                <pre className="spd-try-body">
                                  {typeof tryResult.data === 'object'
                                    ? JSON.stringify(tryResult.data, null, 2)
                                    : tryResult.data}
                                </pre>
                              </>
                          }
                        </div>
                      )}

                      {/* Documentation content */}
                      <div className="spd-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match
                                ? <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                : <code className={className} {...props}>{children}</code>;
                            }
                          }}>
                          {req.content || '*No documentation content.*'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="spd-footer">
              <div className="sd-logo" style={{ opacity: 0.5 }}><img src={nexusLogo} className="sd-logo-img" alt="Nexus" /> Powered by Nexus</div>
              <span>{new Date(doc.generatedAt).toLocaleString()}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
