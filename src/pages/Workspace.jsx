import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Sidebar from '../components/Sidebar/Sidebar';
import RequestBuilder from '../components/RequestBuilder/RequestBuilder';
import ResponseViewer from '../components/ResponseViewer/ResponseViewer';
import DocViewer from '../components/DocViewer/DocViewer';
import SettingsModal from '../components/SettingsModal/SettingsModal';
import NexusAI from '../components/NexusAI/NexusAI';
import { BookOpen } from 'lucide-react';
import './Workspace.css';

export default function Workspace() {
  const { state } = useApp();
  const navigate  = useNavigate();
  const [response, setResponse]         = useState(null);
  const [lastRequest, setLastRequest]   = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab]       = useState('response');
  const [latestDoc, setLatestDoc]       = useState(null);

  function handleResponse(res, req) {
    setResponse(res);
    setLastRequest(req);
    setActiveTab('response');
  }

  function handleDocGenerated(doc) {
    setLatestDoc(doc);
    setActiveTab('doc');
  }

  return (
    <div className="app-shell">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />

      <div className="main-area">
        {/* Top Nav */}
        <nav className="topbar">
          <div className="topbar-tabs">
            <button
              className={`topbar-tab ${activeTab === 'response' ? 'active' : ''}`}
              onClick={() => setActiveTab('response')}>
              Response
            </button>
            <button
              className={`topbar-tab ${activeTab === 'doc' ? 'active' : ''}`}
              onClick={() => setActiveTab('doc')}>
              Documentation
            </button>
          </div>
          {state.activeProjectId && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/project-docs')}>
              <BookOpen size={13} /> Project Docs
            </button>
          )}
        </nav>

        {/* Request Builder */}
        <RequestBuilder onResponse={handleResponse} />

        {/* Workspace Panel */}
        <div className="workspace">
          {activeTab === 'response' && (
            <ResponseViewer
              response={response}
              lastRequest={lastRequest}
              onDocGenerated={handleDocGenerated}
            />
          )}
          {activeTab === 'doc' && (
            <DocViewer
              doc={latestDoc}
              onUpdate={setLatestDoc}
              onDelete={() => { setLatestDoc(null); setActiveTab('response'); }}
            />
          )}
        </div>
      </div>

      {/* Nexus AI — persistent right panel */}
      <NexusAI />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
