import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isAdmin } from '../appwrite/database';

// Full-screen loader shown while Appwrite session resolves
function AuthLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-primary)', flexDirection:'column', gap:16 }}>
      <div style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'var(--text-muted)', fontSize:13 }}>Loading workspace…</p>
    </div>
  );
}

/** Guards any route that requires a logged-in user */
export function AuthRequired({ children }) {
  const { state } = useApp();
  const location  = useLocation();
  if (state.authLoading) return <AuthLoader />;
  if (!state.user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Guards the admin route — requires admin label */
export function AdminRequired({ children }) {
  const { state } = useApp();
  const location  = useLocation();
  if (state.authLoading) return <AuthLoader />;
  if (!state.user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin(state.user)) return <Navigate to="/" replace />;
  return children;
}

/** Redirects already-logged-in users away from /login */
export function GuestOnly({ children }) {
  const { state } = useApp();
  if (state.authLoading) return <AuthLoader />;
  if (state.user) return <Navigate to="/" replace />;
  return children;
}
