import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useApp } from '../../context/AppContext';
import { formatBytes, formatMs, statusColor } from '../../utils/helpers';
import { buildDocPrompt } from '../../ai/docPrompt';
import { generateWithGemini } from '../../ai/gemini';
import { generateWithOpenAI } from '../../ai/openai';
import { saveDoc } from '../../appwrite/database';
import { useDialog } from '../Dialog/Dialog';
import { Copy, Check, Sparkles, FileText, Loader2 } from 'lucide-react';
import './ResponseViewer.css';

export default function ResponseViewer({ response, lastRequest, onDocGenerated }) {
  const { state } = useApp();
  const { toast } = useDialog();
  const [resTab, setResTab] = useState('body');
  const [copied, setCopied] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const isDark = state.theme === 'dark';

  if (!response) {
    return (
      <div className="response-viewer response-empty">
        <div className="empty-state">
          <FileText size={48} />
          <p>Send a request to see the response</p>
          <span>Results will appear here</span>
        </div>
      </div>
    );
  }

  if (response.error) {
    return (
      <div className="response-viewer">
        <div className="rv-error-panel">
          <div className="rv-error-icon">⚠</div>
          <p className="rv-error-title">Request Failed</p>
          <p className="rv-error-msg">{response.error}</p>
          {response.time && <p className="rv-meta" style={{ marginTop: 8 }}>Failed after {formatMs(response.time)}</p>}
        </div>
      </div>
    );
  }

  const statusClr = statusColor(response.status);
  const bodyStr   = typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data || '');
  const isJSON    = typeof response.data === 'object' && response.data !== null;

  async function copyBody() {
    await navigator.clipboard.writeText(bodyStr);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function generateDocs() {
    if (!lastRequest) { toast('No request context available.', 'warning'); return; }
    if (!state.activeProjectId) { toast('Select a project first.', 'warning'); return; }

    const openaiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!openaiKey) {
      toast('VITE_GEMINI_API_KEY is not set in your .env file.', 'error', 6000); return;
    }

    setGenLoading(true);
    try {
      const reqCtx = { method: lastRequest.method, url: lastRequest.url, headers: lastRequest.headers, body: lastRequest.body, auth: lastRequest.auth };
      const resCtx = { status: response.status, body: response.data };
      const prompt = buildDocPrompt(reqCtx, resCtx);

      const markdown = await generateWithOpenAI(prompt);

      const saved = await saveDoc({
        projectId:  state.activeProjectId,
        requestId:  lastRequest.$id || '',
        userId:     state.user?.$id || '',
        title:      lastRequest.name || `${lastRequest.method} ${lastRequest.url}`,
        content:    markdown,
        method:     lastRequest.method,
        url:        lastRequest.url,
        password:   '',
      });

      onDocGenerated?.({ ...saved, content: markdown });
      toast('Documentation generated! Switched to Documentation tab.', 'success', 4000);
    } catch (e) {
      toast('Doc generation failed: ' + e.message, 'error', 6000);
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <div className="response-viewer">
      <div className="rv-statusbar">
        <div className="rv-status-group">
          <span className="rv-status-badge" style={{ color: statusClr, background: statusClr + '1a', borderColor: statusClr + '44' }}>
            {response.status} {response.statusText}
          </span>
          <span className="rv-meta">{formatMs(response.time)}</span>
          <span className="rv-meta">{formatBytes(response.size)}</span>
        </div>
        <div className="rv-actions">
          <button className="btn btn-ghost btn-sm" onClick={generateDocs} disabled={genLoading}>
            {genLoading ? <><Loader2 size={13} className="spin" /> Generating…</> : <><Sparkles size={13} /> Generate Docs</>}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={copyBody}>
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>

      <div className="tabs rv-tabs">
        {['body', 'headers'].map(t => (
          <button key={t} className={`tab-btn ${resTab === t ? 'active' : ''}`} onClick={() => setResTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {resTab === 'body' && (
        <div className="rv-body">
          {isJSON ? (
            <SyntaxHighlighter language="json" style={isDark ? vscDarkPlus : oneLight}
              customStyle={{ margin: 0, background: 'transparent', fontSize: 13, padding: '12px 16px' }}
              wrapLongLines={false}>
              {bodyStr}
            </SyntaxHighlighter>
          ) : (
            <pre className="rv-raw">{bodyStr}</pre>
          )}
        </div>
      )}

      {resTab === 'headers' && (
        <div className="rv-headers">
          <table className="kv-table">
            <thead><tr><th>Header</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(response.headers || {}).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', padding: '5px 12px' }}>{k}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '5px 12px', color: 'var(--text-secondary)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
