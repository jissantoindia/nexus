import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { login, getUser } from '../appwrite/database';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useDialog } from '../components/Dialog/Dialog';
import './LoginPage.css';

export default function LoginPage() {
  const { dispatch } = useApp();
  const { toast } = useDialog();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      const user = await getUser();
      dispatch({ type: 'SET_USER', payload: user });
      toast(`Welcome back, ${user.name}!`, 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Background glow */}
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <div className="login-card glass">
        {/* Logo */}
        <div className="login-logo">
          <img src="/flash.png" className="login-logo-img" alt="Nexus" />
          <span className="login-logo-text">Nexus</span>
        </div>

        <h1 className="login-title">Sign in to your workspace</h1>
        <p className="login-subtitle">API testing & documentation platform</p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className={`input login-input ${error ? 'input-error' : ''}`}
              type="email"
              placeholder="admin@nexusapi.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-pass-wrap">
              <input
                className={`input login-input ${error ? 'input-error' : ''}`}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                required
              />
              <button type="button" className="login-pass-toggle" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading
              ? <><span className="login-spinner" />Signing in…</>
              : 'Sign In'
            }
          </button>
        </form>

        <p className="login-footer">
          Developed by <span className="login-brand">Eduzere Technologies</span>
        </p>
      </div>
    </div>
  );
}
