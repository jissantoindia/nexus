import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getDoc } from '../appwrite/database';
import { buildUrl } from '../utils/helpers';
import { Lock, Send, ArrowLeft, Zap } from 'lucide-react';
import './SharedDoc.css';

export default function SharedDoc() {
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [tryResult, setTryResult] = useState(null);
  const [tryLoading, setTryLoading] = useState(false);

  useEffect(() => {
    getDoc(docId)
      .then(d => { setDoc(d); if (!d.password) setUnlocked(true); })
      .catch(() => setError('Document not found or not accessible.'))
      .finally(() => setLoading(false));
  }, [docId]);

  function checkPassword() {
    if (passwordInput === doc.password) {
      setUnlocked(true);
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2800);
    }
  }

  async function tryApi() {
    if (!doc) return;
    setTryLoading(true); setTryResult(null);
    const headers = {};
    if (authKey) headers['Authorization'] = `Bearer ${authKey}`;
    try {
      const start = Date.now();
      const res = await fetch(doc.url, { method: doc.method || 'GET', headers });
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
      <div className="sd-error"><p>{error}</p><Link to="/" className="btn btn-ghost"><ArrowLeft size={14}/> Back to Nexus</Link></div>
    </div>
  );

  if (!unlocked) return (
    <div className="shared-doc-page">
      <div className="sd-password-gate">
        <div className="sd-pw-card glass">
          <div className="sd-pw-icon"><Lock size={24} /></div>
          <h2>Protected Documentation</h2>
          <p>This API documentation is password protected.</p>
          <input className={`input ${passwordError ? 'input-error' : ''}`} type="password" placeholder="Enter password…"
            value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
            onKeyDown={e => e.key === 'Enter' && checkPassword()} />
          {passwordError && (
            <p className="sd-pw-error">Incorrect password. Please try again.</p>
          )}
          <button className="btn btn-primary" onClick={checkPassword}>Unlock</button>
        </div>
      </div>
    </div>
  );

  const statusClr = tryResult?.status ? (tryResult.status < 300 ? '#22d3a0' : tryResult.status < 500 ? '#f97316' : '#ef4444') : '#8b9ab1';

  return (
    <div className="shared-doc-page">
      <header className="sd-header">
        <div className="sd-header-inner">
          <div className="sd-logo"><img src="/flash.png" className="sd-logo-img" alt="Nexus" /> Nexus</div>
          <div className="sd-endpoint">
            <span className={`method-tag method-${doc.method}`}>{doc.method}</span>
            <code className="sd-url">{doc.url}</code>
          </div>
          <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={13}/> Open App</Link>
        </div>
      </header>

      <div className="sd-layout">
        {/* Doc Content */}
        <main className="sd-main">
          <div className="dv-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match
                    ? <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                    : <code className={className} {...props}>{children}</code>;
                }
              }}>
              {doc.content}
            </ReactMarkdown>
          </div>
        </main>

        {/* Live Try Panel */}
        <aside className="sd-try-panel glass">
          <h3 className="sd-try-title"><Send size={14}/> Try It Live</h3>
          <label className="field-label">Auth Key (optional)</label>
          <input className="input" value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="Bearer token or API key…" />
          <button className="btn btn-primary sd-try-btn" onClick={tryApi} disabled={tryLoading}>
            {tryLoading ? 'Sending…' : <><Send size={13}/> Test API</>}
          </button>

          {tryResult && (
            <div className="sd-try-result">
              {tryResult.error
                ? <p className="sd-try-error">{tryResult.error}</p>
                : <>
                  <div className="sd-try-status">
                    <span style={{ color: statusClr, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{tryResult.status}</span>
                    <span className="rv-meta">{tryResult.time}ms</span>
                  </div>
                  <pre className="sd-try-body">{typeof tryResult.data === 'object' ? JSON.stringify(tryResult.data, null, 2) : tryResult.data}</pre>
                </>
              }
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
