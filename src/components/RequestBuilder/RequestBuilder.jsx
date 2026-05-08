import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { interpolateRequest, buildUrl, generateId } from '../../utils/helpers';
import { getRequests, saveRequest, updateRequest } from '../../appwrite/database';
import { loadEnvVars, getActiveEnvMap, getBaseUrl, interpolateEnv } from '../../utils/envVars';
import { Send, Plus, X, Save, Loader2, Globe } from 'lucide-react';
import { useDialog } from '../Dialog/Dialog';
import './RequestBuilder.css';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const EMPTY_REQUEST = {
  $id: null, name: '', method: 'GET', url: '',
  params: [], headers: [], body: '', bodyType: 'json',
  auth: { type: 'none' }, description: '',
};

export default function RequestBuilder({ onResponse }) {
  const { state, dispatch } = useApp();
  const { toast } = useDialog();
  const [tab, setTab] = useState('params');
  const [req, setReq] = useState(EMPTY_REQUEST);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [envMap, setEnvMap] = useState({});
  const [baseUrl, setBaseUrl] = useState('');

  // Load active request from Appwrite when activeRequestId changes
  useEffect(() => {
    if (!state.activeRequestId || !state.activeProjectId) { setReq(EMPTY_REQUEST); return; }
    getRequests(state.activeProjectId).then(list => {
      const found = list.find(r => r.$id === state.activeRequestId);
      if (found) setReq({ ...EMPTY_REQUEST, ...found });
    }).catch(() => {});
  }, [state.activeRequestId, state.activeProjectId]);

  // Reload env vars when project changes
  useEffect(() => {
    if (state.activeProjectId) {
      const map = getActiveEnvMap(state.activeProjectId);
      setEnvMap(map);
      setBaseUrl(getBaseUrl(state.activeProjectId));
    } else {
      setEnvMap({});
      setBaseUrl('');
    }
  }, [state.activeProjectId]);

  function update(patch) { setReq(prev => ({ ...prev, ...patch })); }

  // ── Send request ──────────────────────────────────────────────────────────
  async function send() {
    if (!req.url.trim()) { toast('Please enter a URL.', 'warning'); return; }

    setSending(true);
    // Refresh env map right before sending (user may have changed vars)
    const currentEnvMap = state.activeProjectId ? getActiveEnvMap(state.activeProjectId) : {};
    const interpolated  = interpolateRequest(req, currentEnvMap);
    // Interpolate {{vars}} in the URL
    let rawUrl = interpolateEnv(interpolated.url, currentEnvMap);
    if (!rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl;
    const finalUrl = buildUrl(rawUrl, interpolated.params || []);

    const headers = {};
    // Also interpolate header values
    (interpolated.headers || []).filter(h => h.enabled !== false && h.key).forEach(h => {
      headers[interpolateEnv(h.key, currentEnvMap)] = interpolateEnv(h.value, currentEnvMap);
    });

    if (interpolated.auth?.type === 'bearer' && interpolated.auth.token)
      headers['Authorization'] = `Bearer ${interpolated.auth.token}`;
    else if (interpolated.auth?.type === 'basic')
      headers['Authorization'] = `Basic ${btoa(`${interpolated.auth.username}:${interpolated.auth.password}`)}`;
    else if (interpolated.auth?.type === 'apikey' && interpolated.auth.key && interpolated.auth.in === 'header')
      headers[interpolated.auth.key] = interpolated.auth.value || '';

    const options = { method: req.method, headers };
    const canHaveBody = !['GET', 'HEAD'].includes(req.method);
    if (canHaveBody && req.bodyType !== 'none') {
      const bt = req.bodyType || 'json';

      if (bt === 'form-data') {
        // KV body stored as JSON array
        const pairs = (() => { try { return JSON.parse(req.body || '[]'); } catch { return []; } })();
        const fd = new FormData();
        pairs.filter(p => p.enabled !== false && p.key).forEach(p => fd.append(p.key, p.value));
        options.body = fd;
        // Let browser set Content-Type with boundary automatically

      } else if (bt === 'urlencoded') {
        const pairs = (() => { try { return JSON.parse(req.body || '[]'); } catch { return []; } })();
        const usp = new URLSearchParams();
        pairs.filter(p => p.enabled !== false && p.key).forEach(p => usp.append(p.key, p.value));
        options.body = usp.toString();
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';

      } else if (bt === 'json' && req.body) {
        options.body = req.body;
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

      } else if (bt === 'text' && req.body) {
        options.body = req.body;
        if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
      }
    }

    const start = Date.now();
    try {
      let result;

      // ── Electron IPC path (CORS-free via Node.js / axios) ─────────────────
      if (window.electronAPI?.isElectron) {
        const ipcResult = await window.electronAPI.sendRequest({
          method:   req.method,
          url:      finalUrl,
          headers,
          bodyType: req.bodyType || 'none',
          body:     req.body || '',
        });

        if (ipcResult.error && ipcResult.status === 0) {
          throw new Error(ipcResult.error);
        }

        result = ipcResult;

      // ── Web browser fetch path ─────────────────────────────────────────────
      } else {
        const res = await fetch(finalUrl, options);
        const time = Date.now() - start;
        const rawText = await res.text();
        let data = rawText;
        try { data = JSON.parse(rawText); } catch { /* keep raw */ }
        result = {
          status:     res.status,
          statusText: res.statusText,
          time,
          size:    new Blob([rawText]).size,
          data,
          headers: Object.fromEntries([...res.headers]),
        };
      }

      result.time = result.time ?? (Date.now() - start);
      onResponse(result, req);

      // Save to history
      const h = JSON.parse(localStorage.getItem('nexus_history') || '[]');
      const entry = { method: req.method, url: finalUrl, status: result.status, time: Date.now() };
      localStorage.setItem('nexus_history', JSON.stringify([entry, ...h].slice(0, 100)));

    } catch (err) {
      let msg = err.message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
        msg = 'Network error — the server may be unreachable or blocking CORS. Try using a CORS-enabled API or a proxy.';
      onResponse({ error: msg, time: Date.now() - start }, req);
    } finally {
      setSending(false);
    }
  }

  // ── Save request ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!state.activeProjectId) { toast('Select or create a project first.', 'warning'); return; }
    setSaving(true);
    try {
      const payload = { ...req, projectId: state.activeProjectId, userId: state.user?.$id };
      if (req.$id) {
        await updateRequest(req.$id, payload);
        toast('Request updated.', 'success');
      } else {
        const saved = await saveRequest({ ...payload, name: req.name || req.url || 'Untitled' });
        setReq(prev => ({ ...prev, $id: saved.$id }));
        dispatch({ type: 'SET_ACTIVE_REQUEST', payload: saved.$id });
        toast('Request saved.', 'success');
      }
      window.__nexusRefreshRequests?.();
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
    finally { setSaving(false); }
  }

  function newRequest() {
    dispatch({ type: 'SET_ACTIVE_REQUEST', payload: null });
    setReq(EMPTY_REQUEST);
  }

  return (
    <div className="request-builder">
      <div className="rb-topbar">
        <div className="rb-name-row">
          <input className="input rb-name" value={req.name} onChange={e => update({ name: e.target.value })} placeholder="Request name…" />
          <button className="btn btn-ghost btn-sm" onClick={newRequest}><Plus size={13} /> New</button>
          <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={13} className="spin" /> Saving…</> : <><Save size={13} /> Save</>}
          </button>
        </div>
        <div className="rb-url-row">
          <select className={`method-select method-${req.method}`} value={req.method} onChange={e => update({ method: e.target.value })}>
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="rb-url-wrap">
            {baseUrl && (
              <button
                className="rb-baseurl-badge"
                title={`Base URL: ${baseUrl} (click to insert {{baseUrl}})`}
                onClick={() => update({ url: '{{baseUrl}}' + (req.url.startsWith('/') ? req.url : '/' + req.url) })}>
                <Globe size={11} />
                <span className="rb-baseurl-text">{baseUrl.replace('https://', '').replace('http://', '').split('/')[0]}</span>
              </button>
            )}
            <input
              className="input rb-url"
              value={req.url}
              onChange={e => update({ url: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={baseUrl ? `{{baseUrl}}/endpoint or full URL` : 'https://api.example.com/endpoint'}
            />
          </div>
          <button className="btn btn-primary rb-send" onClick={send} disabled={sending}>
            {sending
              ? <><Loader2 size={14} className="spin" /> Sending…</>
              : <><Send size={14} /> Send</>}
          </button>
        </div>
      </div>

      <div className="tabs rb-tabs">
        {['params', 'auth', 'headers', 'body', 'description'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'params' && req.params.filter(p => p.key).length > 0 && <span className="tab-count">{req.params.filter(p => p.key).length}</span>}
            {t === 'headers' && req.headers.filter(h => h.key).length > 0 && <span className="tab-count">{req.headers.filter(h => h.key).length}</span>}
          </button>
        ))}
      </div>

      <div className="rb-panel">
        {tab === 'params'      && <KVEditor rows={req.params}  onChange={params  => update({ params })}  placeholder={['Key', 'Value']} />}
        {tab === 'headers'     && <KVEditor rows={req.headers} onChange={headers => update({ headers })} placeholder={['Header', 'Value']} suggestions={['Content-Type','Authorization','Accept','X-API-Key','Cache-Control']} />}
        {tab === 'auth'        && <AuthEditor auth={req.auth} onChange={auth => update({ auth })} />}
        {tab === 'body'        && <BodyEditor reqId={req.$id} body={req.body} bodyType={req.bodyType} onChange={(body, bodyType) => update({ body, bodyType })} method={req.method} />}
        {tab === 'description' && <div className="rb-desc"><textarea className="input" value={req.description} onChange={e => update({ description: e.target.value })} placeholder="Describe this request… (Markdown supported)" style={{ minHeight: 180, fontFamily: 'var(--font)' }} /></div>}
      </div>
    </div>
  );
}

// ── KV Editor ─────────────────────────────────────────────────────────────────
function KVEditor({ rows = [], onChange, placeholder = ['key', 'value'], suggestions = [] }) {
  const ensure = r => r.length === 0 || r[r.length - 1]?.key !== '' ? [...r, { key: '', value: '', enabled: true }] : r;
  const displayed = ensure(rows);

  function update(i, field, val) {
    const copy = [...displayed];
    copy[i] = { ...copy[i], [field]: val };
    onChange(copy.filter((r, idx) => idx < copy.length - 1 ? r.key !== '' : true).filter((r, idx, arr) => !(idx === arr.length - 1 && !r.key)));
  }
  function remove(i) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <div className="kv-editor">
      <table className="kv-table">
        <thead><tr><th className="kv-row-check" /><th>{placeholder[0]}</th><th>{placeholder[1]}</th><th style={{ width: 30 }} /></tr></thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={i}>
              <td><input type="checkbox" checked={row.enabled !== false} onChange={e => update(i, 'enabled', e.target.checked)} /></td>
              <td><input className="input kv-input" value={row.key} onChange={e => update(i, 'key', e.target.value)} placeholder={placeholder[0]} list={`sug-${placeholder[0]}`} /></td>
              <td><input className="input kv-input" value={row.value} onChange={e => update(i, 'value', e.target.value)} placeholder={placeholder[1]} /></td>
              <td>{row.key && <button className="btn btn-icon btn-ghost btn-sm" onClick={() => remove(i)}><X size={11} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {suggestions.length > 0 && <datalist id={`sug-${placeholder[0]}`}>{suggestions.map(s => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}

// ── Auth Editor ───────────────────────────────────────────────────────────────
function AuthEditor({ auth = { type: 'none' }, onChange }) {
  const set = patch => onChange({ ...auth, ...patch });
  return (
    <div className="auth-editor">
      <div className="auth-type-row">
        <label className="field-label">Auth Type</label>
        <select className="input" value={auth.type} onChange={e => set({ type: e.target.value })} style={{ maxWidth: 200 }}>
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>
      {auth.type === 'bearer' && <div className="auth-fields"><label className="field-label">Token</label><input className="input" value={auth.token || ''} onChange={e => set({ token: e.target.value })} placeholder="Bearer token…" /></div>}
      {auth.type === 'basic' && <div className="auth-fields">
        <label className="field-label">Username</label><input className="input" value={auth.username || ''} onChange={e => set({ username: e.target.value })} placeholder="Username" />
        <label className="field-label" style={{ marginTop: 10 }}>Password</label><input className="input" type="password" value={auth.password || ''} onChange={e => set({ password: e.target.value })} placeholder="Password" />
      </div>}
      {auth.type === 'apikey' && <div className="auth-fields">
        <label className="field-label">Key</label><input className="input" value={auth.key || ''} onChange={e => set({ key: e.target.value })} placeholder="X-API-Key" />
        <label className="field-label" style={{ marginTop: 10 }}>Value</label><input className="input" value={auth.value || ''} onChange={e => set({ value: e.target.value })} placeholder="your-api-key" />
        <label className="field-label" style={{ marginTop: 10 }}>Add to</label>
        <select className="input" value={auth.in || 'header'} onChange={e => set({ in: e.target.value })} style={{ maxWidth: 160 }}>
          <option value="header">Header</option><option value="query">Query Param</option>
        </select>
      </div>}
    </div>
  );
}

// ── Body Editor ───────────────────────────────────────────────────────────────
function BodyEditor({ reqId, body = '', bodyType = 'json', onChange, method }) {
  if (['GET', 'HEAD'].includes(method))
    return <div className="rb-no-body"><p>GET / HEAD requests cannot have a body.</p></div>;

  const isKV = bodyType === 'form-data' || bodyType === 'urlencoded';

  // ── Per-mode draft storage ────────────────────────────────────────────────────────────
  // Seeded from props; resets when reqId changes (new request loaded)
  const [drafts, setDrafts] = React.useState(() => ({
    none: '', json: body || '', 'form-data': '[]', urlencoded: '[]', text: '',
    [bodyType]: body || (isKV ? '[]' : ''),
  }));

  // When a completely new request is loaded, re-seed drafts from props
  const prevReqId = React.useRef(reqId);
  React.useEffect(() => {
    if (reqId !== prevReqId.current) {
      prevReqId.current = reqId;
      const kv = bodyType === 'form-data' || bodyType === 'urlencoded';
      setDrafts({ none: '', json: '', 'form-data': '[]', urlencoded: '[]', text: '', [bodyType]: body || (kv ? '[]' : '') });
    }
  }, [reqId, body, bodyType]);

  // Current live value for the active type
  const currentValue = drafts[bodyType] ?? '';

  // ── Helpers ────────────────────────────────────────────────────────────────────
  function parseRows(str) {
    try { const r = JSON.parse(str || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
  }

  // Live update within the current type (does NOT switch type)
  function handleRawChange(val) {
    setDrafts(d => ({ ...d, [bodyType]: val }));
    onChange(val, bodyType);
  }

  function handleKVChange(rows) {
    const str = JSON.stringify(rows);
    setDrafts(d => ({ ...d, [bodyType]: str }));
    onChange(str, bodyType);
  }

  // ── Tab switching with cross-conversion ──────────────────────────────────────────
  function switchType(newType) {
    if (newType === bodyType) return;

    const wasKV  = bodyType === 'form-data' || bodyType === 'urlencoded';
    const willKV = newType === 'form-data' || newType === 'urlencoded';

    setDrafts(prev => {
      const next = { ...prev, [bodyType]: currentValue }; // save current draft

      // KV → JSON: auto-build JSON object from form fields
      if (wasKV && newType === 'json') {
        const pairs = parseRows(currentValue);
        const obj   = {};
        pairs.filter(p => p.enabled !== false && p.key)
             .forEach(p => { obj[p.key] = p.value; });
        const generated = JSON.stringify(obj, null, 2);
        // Only replace the json draft if it's still empty or was auto-generated
        next.json = generated;
      }

      // JSON → KV: try to parse JSON object into rows
      if (!wasKV && bodyType === 'json' && willKV) {
        try {
          const obj = JSON.parse(prev.json || '{}');
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            const rows = Object.entries(obj).map(([k, v]) => ({
              key: k, value: String(v), enabled: true,
            }));
            next[newType] = JSON.stringify(rows);
          }
        } catch { /* keep existing KV draft */ }
      }

      return next;
    });

    // Notify parent with the target type's current draft
    // Use a timeout to read updated state
    setTimeout(() => {
      setDrafts(latest => {
        onChange(latest[newType] ?? '', newType);
        return latest;
      });
    }, 0);
  }

  const TYPES = [
    { id: 'none',       label: 'None' },
    { id: 'json',       label: 'JSON' },
    { id: 'form-data',  label: 'Form Data' },
    { id: 'urlencoded', label: 'URL Encoded' },
    { id: 'text',       label: 'Text' },
  ];

  return (
    <div className="body-editor">
      {/* Mode switcher */}
      <div className="body-type-row">
        {TYPES.map(({ id, label }) => (
          <button
            key={id}
            className={`body-type-btn ${bodyType === id ? 'active' : ''}`}
            onClick={() => switchType(id)}>
            {label}
          </button>
        ))}
        {bodyType !== 'none' && (
          <span className="body-type-hint">
            {bodyType === 'json'       && 'Content-Type: application/json'}
            {bodyType === 'form-data'  && 'Content-Type: multipart/form-data'}
            {bodyType === 'urlencoded' && 'Content-Type: application/x-www-form-urlencoded'}
            {bodyType === 'text'       && 'Content-Type: text/plain'}
          </span>
        )}
      </div>

      {/* None */}
      {bodyType === 'none' && (
        <div className="body-none-msg">This request has no body.</div>
      )}

      {/* KV editor (form-data / urlencoded) */}
      {isKV && (
        <div className="body-kv-wrap">
          <BodyKVEditor rows={parseRows(currentValue)} onChange={handleKVChange} />
        </div>
      )}

      {/* Raw textarea (json / text) */}
      {!isKV && bodyType !== 'none' && (
        <textarea
          className="input body-textarea"
          value={currentValue}
          onChange={e => handleRawChange(e.target.value)}
          placeholder={
            bodyType === 'json'
              ? '{\n  "key": "value"\n}'
              : 'Plain text body…'
          }
          spellCheck={false}
        />
      )}
    </div>
  );
}

// ── Body KV Editor ─────────────────────────────────────────────────────────────
function BodyKVEditor({ rows = [], onChange }) {
  // Always keep one blank row at the end
  const ensure = r =>
    r.length === 0 || r[r.length - 1]?.key !== ''
      ? [...r, { key: '', value: '', enabled: true }]
      : r;

  const displayed = ensure(rows);

  function update(i, field, val) {
    const copy = [...displayed];
    copy[i] = { ...copy[i], [field]: val };
    // Remove fully-empty trailing rows except the last placeholder
    const cleaned = copy.filter((r, idx) =>
      idx < copy.length - 1 ? r.key !== '' : true
    ).filter((r, idx, arr) =>
      !(idx === arr.length - 1 && !r.key)
    );
    onChange(cleaned);
  }

  function remove(i) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <table className="kv-table body-kv-table">
      <thead>
        <tr>
          <th className="kv-row-check" />
          <th>Key</th>
          <th>Value</th>
          <th style={{ width: 30 }} />
        </tr>
      </thead>
      <tbody>
        {displayed.map((row, i) => (
          <tr key={i}>
            <td>
              <input
                type="checkbox"
                checked={row.enabled !== false}
                onChange={e => update(i, 'enabled', e.target.checked)}
              />
            </td>
            <td>
              <input
                className="input kv-input"
                value={row.key}
                onChange={e => update(i, 'key', e.target.value)}
                placeholder="field_name"
              />
            </td>
            <td>
              <input
                className="input kv-input"
                value={row.value}
                onChange={e => update(i, 'value', e.target.value)}
                placeholder="value"
              />
            </td>
            <td>
              {row.key && (
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => remove(i)}>
                  <X size={11} />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
