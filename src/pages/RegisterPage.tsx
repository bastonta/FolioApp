import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, UserPlus, User, Mail, Lock, AlertCircle, Loader, Server } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, serverUrl } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const res = await register(name, email, password);
      // Ensure register API returns these fields or adapt to your API
      const { userId, resendAfter } = res || {};
      
      navigate('/confirm-email', { 
        state: { 
          userId, 
          email, 
          resendAfter 
        } 
      });
    } catch (err) {
      setError((err as any)?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {serverUrl && (
          <div className="auth-server-badge">
            <Server size={14} />
            <span>{new URL(serverUrl).host}</span>
          </div>
        )}

        <div className="auth-header">
          <div className="auth-icon-badge">
            <BookOpen size={24} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Sign up to get started</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="name">Full Name</label>
            <div className="auth-input-wrapper">
              <div className="auth-input-icon">
                <User size={20} />
              </div>
              <input
                id="name"
                type="text"
                className="auth-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <div className="auth-input-wrapper">
              <div className="auth-input-icon">
                <Mail size={20} />
              </div>
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <div className="auth-input-icon">
                <Lock size={20} />
              </div>
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading || !name || !email || !password}>
            {loading ? <Loader size={20} className="spinner" /> : <UserPlus size={20} />}
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
          </button>
          
          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="auth-footer-text">
            Already have an account? <Link to="/login" className="auth-link">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
