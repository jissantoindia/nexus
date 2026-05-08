import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { DialogProvider } from './components/Dialog/Dialog';
import { AuthRequired, AdminRequired, GuestOnly } from './components/ProtectedRoute';
import Workspace from './pages/Workspace';
import ProjectDocs from './pages/ProjectDocs';
import SharedDoc from './pages/SharedDoc';
import SharedProjectDoc from './pages/SharedProjectDoc';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import UpdateBanner from './components/UpdateBanner/UpdateBanner';
import './index.css';

export default function App() {
  return (
    <AppProvider>
      <DialogProvider>
        <HashRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/docs/:docId" element={<SharedDoc />} />
            <Route path="/docs/project/:projectId" element={<SharedProjectDoc />} />

            {/* Protected routes — must be logged in */}
            <Route path="/" element={<AuthRequired><Workspace /></AuthRequired>} />
            <Route path="/project-docs" element={<AuthRequired><ProjectDocs /></AuthRequired>} />

            {/* Admin-only route */}
            <Route path="/admin" element={<AdminRequired><AdminPage /></AdminRequired>} />
          </Routes>
        </HashRouter>
        <UpdateBanner />
      </DialogProvider>
    </AppProvider>
  );
}
