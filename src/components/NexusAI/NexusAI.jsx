import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getProjects, getSharedProjects, getRequests } from '../../appwrite/database';
import { Send, ChevronRight, X, RefreshCw, User, Loader2, ChevronDown, SlidersHorizontal, FolderOpen, Globe } from 'lucide-react';
import aiLogo from '/ai.png';
import nexusLogo from '/flash.png';
import './NexusAI.css';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const WELCOME = `Hey! I'm **Nexus AI** ✦

I can help you with:
- 📖 Understanding your API endpoints
- 💻 Code generation in any language (JS, Python, cURL, Go, PHP…)
- 🔍 Explaining request/response structures
- 🛠️ Debugging API issues
- 📝 API design review & documentation

Select a **project** or a specific **endpoint** above, then ask me anything!`;

export default function NexusAI() {
  const { state } = useApp();
  const [open, setOpen]                     = useState(true);
  const [showSelectors, setShowSelectors]   = useState(false);  // collapsible drawer
  const [projects, setProjects]             = useState([]);
  const [selectedProjId, setSelectedProjId] = useState('');
  const [projectRequests, setProjectRequests] = useState([]);
  const [selectedReqId, setSelectedReqId]   = useState('');
  const [messages, setMessages]             = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput]                   = useState('');
  const [streaming, setStreaming]           = useState(false);
  const [loadingProj, setLoadingProj]       = useState(false);
  const bottomRef                           = useRef(null);
  const inputRef                            = useRef(null);
  const abortRef                            = useRef(null);

  const userId = state.user?.$id;

  // ── Load projects (owned + shared) ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const email = state.user?.email;
    Promise.all([
      getProjects(userId).catch(() => []),
      getSharedProjects(email).catch(() => []),
    ]).then(([owned, shared]) => {
      // Merge, dedup by $id
      const seen = new Set();
      const all = [...owned, ...shared].filter(p => {
        if (seen.has(p.$id)) return false;
        seen.add(p.$id);
        return true;
      });
      setProjects(all);
    });
  }, [userId]);

  // Auto-select active project
  useEffect(() => {
    if (state.activeProjectId && !selectedProjId) {
      setSelectedProjId(state.activeProjectId);
    }
  }, [state.activeProjectId]);

  // Auto-select active request when it changes
  useEffect(() => {
    if (state.activeRequestId) setSelectedReqId(state.activeRequestId);
  }, [state.activeRequestId]);

  // ── Load requests when project changes ────────────────────────────────────
  useEffect(() => {
    if (!selectedProjId) { setProjectRequests([]); setSelectedReqId(''); return; }
    setLoadingProj(true);
    getRequests(selectedProjId)
      .then(reqs => { setProjectRequests(reqs); })
      .catch(() => setProjectRequests([]))
      .finally(() => setLoadingProj(false));
  }, [selectedProjId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Build system prompt ────────────────────────────────────────────────────
  function buildSystemPrompt() {
    const proj = projects.find(p => p.$id === selectedProjId);
    const base = `You are Nexus AI, an expert API assistant embedded in NexusAPI — a professional API testing and documentation platform. Be concise, technical, and helpful. Always format code in markdown code blocks with the correct language tag.`;

    if (!proj) return base;

    // If a specific request is selected, focus on it
    const focusedReq = projectRequests.find(r => r.$id === selectedReqId);
    if (focusedReq) {
      return `${base}

The user is asking about a specific API endpoint from project **${proj.name}**:

**Endpoint:** ${focusedReq.method} ${focusedReq.url}
**Name:** ${focusedReq.name || 'Unnamed'}
${focusedReq.folder ? `**Folder:** ${focusedReq.folder}` : ''}
${focusedReq.description ? `**Description:** ${focusedReq.description}` : ''}
${focusedReq.headers?.length ? `**Headers:** ${JSON.stringify(focusedReq.headers.filter(h => h.key), null, 2)}` : ''}
${focusedReq.body ? `**Body:** ${focusedReq.body}` : ''}
${focusedReq.auth?.type !== 'none' ? `**Auth:** ${JSON.stringify(focusedReq.auth)}` : ''}

Focus your response on this specific endpoint. Provide exact code examples using this URL and method.`;
    }

    // Otherwise give full project context
    const endpointList = projectRequests.slice(0, 60).map(r =>
      `- ${r.method} ${r.url}${r.name ? ` (${r.name})` : ''}${r.folder ? ` [${r.folder}]` : ''}`
    ).join('\n');

    return `${base}

Project: **${proj.name}** · ${projectRequests.length} endpoints

${endpointList}

Reference these endpoints when answering. Use the actual URLs and methods in code examples.`;
  }

  // ── Send with streaming ────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    if (!GEMINI_KEY) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ **AI key not set.** Add `VITE_GEMINI_API_KEY` to your `.env` file.',
        error: true,
      }]);
      return;
    }

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      // Build Gemini contents array (system prompt prepended as first user turn)
      const geminiContents = [
        { role: 'user', parts: [{ text: buildSystemPrompt() }] },
        { role: 'model', parts: [{ text: 'Understood. I am Nexus AI, ready to help with your API.' }] },
        ...history.slice(1).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: text }] },
      ];

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
        {
          method: 'POST',
          signal: abortRef.current.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: { temperature: 0.35, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
      }

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            // Gemini SSE format: candidates[0].content.parts[0].text
            const chunk = JSON.parse(data);
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullContent += text;
            setMessages(prev => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: 'assistant', content: fullContent, streaming: true };
              return copy;
            });
          } catch {}
        }
      }

      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: fullContent };
        return copy;
      });
    } catch (e) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = e.name === 'AbortError'
          ? { ...copy[copy.length - 1], streaming: false, stopped: true }
          : { role: 'assistant', content: `⚠️ ${e.message}`, error: true };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  // ── Quick prompts — context-aware ─────────────────────────────────────────
  function quickPrompts() {
    const focusedReq = projectRequests.find(r => r.$id === selectedReqId);
    if (focusedReq) {
      return [
        `Generate a JavaScript fetch example for ${focusedReq.method} ${focusedReq.url}`,
        `Generate a Python requests example for this endpoint`,
        `Generate a cURL command for this endpoint`,
        `Explain what this endpoint does and its expected response`,
      ];
    }
    if (selectedProjId) {
      return [
        'List all endpoints in this project',
        'Generate JavaScript fetch examples for all endpoints',
        'Generate a Python requests SDK for this project',
        'Explain the authentication pattern used',
      ];
    }
    return [
      'How do I use environment variables in NexusAPI?',
      'How do I generate API documentation?',
      'How do I import a Postman collection?',
    ];
  }

  const projName     = projects.find(p => p.$id === selectedProjId)?.name;
  const focusedReq   = projectRequests.find(r => r.$id === selectedReqId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`nexus-ai-panel ${open ? 'open' : 'closed'}`}>
      {/* Toggle tab */}
      <button className="nexus-ai-toggle" onClick={() => setOpen(!open)} title={open ? 'Hide Nexus AI' : 'Open Nexus AI'}>
        <div className="nexus-ai-toggle-inner">
          {open ? <ChevronRight size={14} /> : (
            <><img src={aiLogo} className="nexus-ai-icon-img" alt="AI" /><span>Nexus AI</span></>
          )}
        </div>
      </button>

      {open && (
        <div className="nexus-ai-body">
          {/* Header */}
          <div className="nexus-ai-header">
            <div className="nexus-ai-brand">
              <img src={aiLogo} className="nexus-ai-logo-img" alt="Nexus AI" />
              <span>Nexus AI</span>
              <span className="nexus-ai-status-dot" />
            </div>
            <div className="nexus-ai-header-actions">
              <button
                className={`btn btn-icon btn-ghost ${showSelectors ? 'nai-btn-active' : ''}`}
                onClick={() => setShowSelectors(!showSelectors)}
                title={showSelectors ? 'Hide context selector' : 'Select project / endpoint'}>
                <SlidersHorizontal size={13} />
              </button>
              <button className="btn btn-icon btn-ghost" onClick={() => setMessages([{ role: 'assistant', content: WELCOME }])} title="Clear chat">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* ── Context strip — always visible ── */}
          <div className="nexus-ai-context-strip">
            {selectedProjId ? (
              <>
                <FolderOpen size={11} className="nai-strip-icon" />
                <span className="nai-strip-proj">{projName || '…'}</span>
                {focusedReq ? (
                  <>
                    <span className="nai-strip-sep">›</span>
                    <span className={`method-tag method-${focusedReq.method} nai-strip-method`}>{focusedReq.method}</span>
                    <span className="nai-strip-req">{focusedReq.name || focusedReq.url}</span>
                  </>
                ) : (
                  <span className="nai-strip-count">{projectRequests.length} endpoints</span>
                )}
              </>
            ) : (
              <>
                <Globe size={11} className="nai-strip-icon" />
                <span className="nai-strip-none">No context — tap <SlidersHorizontal size={9}/> to select</span>
              </>
            )}
          </div>

          {/* \u2500\u2500 Collapsible selectors drawer \u2500\u2500 */}
          {showSelectors && (
            <div className="nexus-ai-selectors">
              {/* Project */}
              <div className="nexus-ai-select-group">
                <label className="nexus-ai-select-label">Project</label>
                <div className="nexus-ai-project-select-wrap">
                  <select className="nexus-ai-project-select" value={selectedProjId}
                    onChange={e => { setSelectedProjId(e.target.value); setSelectedReqId(''); }}>
                    <option value="">— All projects —</option>
                    {projects.map(p => <option key={p.$id} value={p.$id}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={11} className="nexus-ai-select-icon" />
                </div>
              </div>

              {/* Endpoint */}
              {selectedProjId && (
                <div className="nexus-ai-select-group">
                  <label className="nexus-ai-select-label">
                    Endpoint
                    {loadingProj && <Loader2 size={10} className="spin" style={{ marginLeft: 4 }} />}
                  </label>
                  <div className="nexus-ai-project-select-wrap">
                    <select className="nexus-ai-project-select" value={selectedReqId}
                      onChange={e => setSelectedReqId(e.target.value)}>
                      <option value="">— Full project context —</option>
                      {projectRequests.map(r => (
                        <option key={r.$id} value={r.$id}>{r.method} {r.name || r.url}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="nexus-ai-select-icon" />
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-sm nai-apply-btn"
                onClick={() => setShowSelectors(false)}>
                ✓ Apply &amp; Close
              </button>
            </div>
          )}


          {/* Messages */}
          <div className="nexus-ai-messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length === 1 && !streaming && (
            <div className="nexus-ai-quick-prompts">
              {quickPrompts().map(q => (
                <button key={q} className="nexus-ai-quick-btn"
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="nexus-ai-input-bar">
            <textarea
              ref={inputRef}
              className="nexus-ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={focusedReq
                ? `Ask about ${focusedReq.method} ${focusedReq.name || focusedReq.url}…`
                : 'Ask anything about your APIs…'}
              rows={1}
            />
            {streaming
              ? <button className="nexus-ai-send stop" onClick={() => abortRef.current?.abort()} title="Stop"><X size={15} /></button>
              : <button className="nexus-ai-send" onClick={sendMessage} disabled={!input.trim()} title="Send (Enter)"><Send size={15} /></button>
            }
          </div>
          <p className="nexus-ai-footer">Shift+Enter for new line · Enter to send</p>
        </div>
      )}
    </div>
  );
}

// ── Message ────────────────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`nexus-ai-msg ${isUser ? 'user' : 'assistant'} ${msg.error ? 'error' : ''}`}>
      <div className="nexus-ai-msg-avatar">
        {isUser ? <User size={13} /> : <img src={aiLogo} style={{ width: 13, height: 13, borderRadius: 3, objectFit: 'cover' }} alt="AI" />}
      </div>
      <div className="nexus-ai-msg-content">
        <ReactMarkdownMsg content={msg.content} streaming={msg.streaming} />
        {msg.stopped && <span className="nexus-ai-stopped">— stopped</span>}
      </div>
    </div>
  );
}

function ReactMarkdownMsg({ content, streaming }) {
  const [mods, setMods] = useState(null);

  useEffect(() => {
    Promise.all([
      import('react-markdown').then(m => m.default),
      import('remark-gfm').then(m => m.default),
      import('react-syntax-highlighter/dist/esm/styles/prism').then(m => m.vscDarkPlus),
      import('react-syntax-highlighter').then(m => m.Prism),
    ]).then(([RM, GFM, style, Prism]) => setMods({ RM, GFM, style, Prism }));
  }, []);

  if (!mods || !content) {
    return <span className="nexus-ai-raw">{content}{streaming && <span className="nexus-ai-cursor" />}</span>;
  }

  const { RM, GFM, style, Prism } = mods;
  return (
    <RM remarkPlugins={[GFM]} components={{
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match
          ? <Prism style={style} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</Prism>
          : <code className={className} {...props}>{children}</code>;
      }
    }}>
      {content + (streaming ? '▊' : '')}
    </RM>
  );
}
