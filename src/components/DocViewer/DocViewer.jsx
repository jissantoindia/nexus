import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../Dialog/Dialog';
import { updateDoc, deleteDoc } from '../../appwrite/database';
import { Edit2, Save, Trash2, Lock, Unlock, Copy, Check, ExternalLink, FileText } from 'lucide-react';
import './DocViewer.css';

export default function DocViewer({ doc, onUpdate, onDelete }) {
  const { state } = useApp();
  const { toast, confirm } = useDialog();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(doc?.content || '');
  const [title, setTitle] = useState(doc?.title || '');
  const [password, setPassword] = useState(doc?.password || '');
  const [showPassEdit, setShowPassEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDark = state.theme === 'dark';

  // Sync state when doc changes — watch content too so fresh docs render correctly
  useEffect(() => {
    setContent(doc?.content || '');
    setTitle(doc?.title || '');
    setPassword(doc?.password || '');
    setEditing(false);
    setShowPassEdit(false);
  }, [doc?.$id, doc?.id, doc?.content]);

  const docId  = doc?.$id || doc?.id;
  const docUrl = `${window.location.origin}/docs/${docId}`;

  async function save() {
    setSaving(true);
    try {
      await updateDoc(docId, { content, title, password });
      onUpdate?.({ ...doc, content, title, password });
      setEditing(false);
      toast('Documentation saved.', 'success');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error', 5000);
    } finally { setSaving(false); }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete Documentation',
      message: `"${title || 'This document'}" will be permanently deleted and its shareable link will stop working.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteDoc(docId);
    toast('Documentation deleted.', 'success');
    onDelete?.(docId);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(docUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (!doc) return (
    <div className="doc-viewer doc-empty">
      <div className="empty-state">
        <FileText size={40} />
        <p>No documentation yet for this request.</p>
        <span>Click <strong>Generate Docs</strong> in the Response toolbar after sending a request, or use <strong>Project Docs</strong> to generate docs for all endpoints at once.</span>
      </div>
    </div>
  );

  return (
    <div className="doc-viewer">
      <div className="dv-toolbar">
        <div className="dv-title-row">
          {editing
            ? <input className="input dv-title-input" value={title} onChange={e => setTitle(e.target.value)} />
            : <h2 className="dv-title">{title || 'Untitled Doc'}</h2>}
          <span className={`method-tag method-${doc.method}`}>{doc.method}</span>
        </div>
        <div className="dv-actions">
          <button className="btn btn-ghost btn-sm" onClick={copyLink}>
            {copied ? <><Check size={13}/> Copied</> : <><Copy size={13}/> Copy Link</>}
          </button>
          <a href={docUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13}/> Open</a>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPassEdit(!showPassEdit)}>
            {doc.password ? <><Lock size={13}/> Password</> : <><Unlock size={13}/> No Password</>}
          </button>
          {editing
            ? <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Save size={13}/>{saving ? 'Saving…' : 'Save'}</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Edit2 size={13}/> Edit</button>}
          <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={13}/></button>
        </div>
      </div>

      {showPassEdit && (
        <div className="dv-pass-row">
          <input className="input" style={{ maxWidth: 280 }} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Set password to protect this doc (leave blank = public)" />
          <button className="btn btn-primary btn-sm" onClick={() => { setShowPassEdit(false); }}>Apply</button>
        </div>
      )}

      <div className="dv-content">
        {editing ? (
          <textarea className="input dv-editor" value={content} onChange={e => setContent(e.target.value)} />
        ) : (
          <div className="dv-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter style={isDark ? vscDarkPlus : oneLight} language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : <code className={className} {...props}>{children}</code>;
                }
              }}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
