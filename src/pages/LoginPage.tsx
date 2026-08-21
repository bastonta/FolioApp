import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogIn, Lock, Mail, AlertCircle, ShieldCheck, KeyRound, ArrowLeft, Server, Loader } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [twoFactorData, setTwoFactorData] = useState<{ token: string; need2fa: boolean } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);

  const { login, login2fa, serverUrl, clearServer } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      const res = await login(email, password);
      if (res?.need2fa) {
        setTwoFactorData({ token: res.token, need2fa: true });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError((err as any)?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!twoFactorCode) {
      setError('Please enter the code');
      return;
    }

    try {
      setLoading(true);
      await login2fa(twoFactorData!.token, twoFactorCode, isRecovery ? 'recovery' : 'code');
      navigate('/');
    } catch (err) {
      setError((err as any)?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setTwoFactorData(null);
    setTwoFactorCode('');
    setError('');
  };

  const handleChangeServer = () => {
    clearServer();
    navigate('/server');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {serverUrl && (
          <div className="auth-server-badge" onClick={handleChangeServer} title="Change server">
            <Server size={14} />
            <span>{new URL(serverUrl).host}</span>
          </div>
        )}

        <div className="auth-header">
          <div className="auth-icon-badge">
            {twoFactorData ? <ShieldCheck size={24} /> : <BookOpen size={24} />}
          </div>
          <h1 className="auth-title">
            {twoFactorData ? 'Two-Factor Authentication' : 'Welcome Back'}
          </h1>
          <p className="auth-subtitle">
            {twoFactorData 
              ? (isRecovery ? 'Enter a recovery code to log in' : 'Enter the code from your authenticator app')
              : 'Log in to your account to continue'}
          </p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {!twoFactorData ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
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
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
              </div>
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

            <button type="submit" className="auth-btn-primary" disabled={loading || !email || !password}>
              {loading ? <Loader size={20} className="spinner" /> : <LogIn size={20} />}
              <span>{loading ? 'Logging in...' : 'Log In'}</span>
            </button>
            
            <div className="auth-divider">
              <span>or</span>
            </div>

            <div className="auth-footer-text">
              Don't have an account? <Link to="/register" className="auth-link">Sign up</Link>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handle2faSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="code">
                {isRecovery ? 'Recovery Code' : 'Authentication Code'}
              </label>
              <div className="auth-input-wrapper">
                <div className="auth-input-icon">
                  <KeyRound size={20} />
                </div>
                <input
                  id="code"
                  type="text"
                  className="auth-input auth-input-code"
                  placeholder={isRecovery ? 'XXXXX-XXXXX' : '000000'}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  disabled={loading}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading || !twoFactorCode}>
              {loading ? <Loader size={20} className="spinner" /> : <LogIn size={20} />}
              <span>{loading ? 'Verifying...' : 'Verify & Log In'}</span>
            </button>

            <button 
              type="button" 
              className="auth-btn-text" 
              onClick={() => {
                setIsRecovery(!isRecovery);
                setTwoFactorCode('');
                setError('');
              }}
              disabled={loading}
            >
              {isRecovery ? 'Use authenticator code' : 'Use recovery code'}
            </button>
            
            <button 
              type="button" 
              className="auth-btn-secondary" 
              onClick={handleBackToLogin}
              disabled={loading}
            >
              <ArrowLeft size={20} />
              <span>Back to Login</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
