'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_LOGIN_CSS }} />
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <h1>DUET Reunion 2025</h1>
            <p>Admin Panel</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Sign In'}
            </button>
          </form>
          <a href="/" className="back-link">← Back to Directory</a>
        </div>
      </div>
    </>
  );
}

const ADMIN_LOGIN_CSS = `
:root{--bg:#0d1117;--surface:#161b22;--card:#1c2230;--border:#2a3245;--gold:#c9a84c;--gold-dim:#8a6e2f;--gold-light:#e8c96a;--text:#e8eaf0;--muted:#7a8499;--accent:#3a7bd5;--red:#e05252}
body{background:var(--bg);font-family:'DM Sans',sans-serif;margin:0}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 30% 20%,rgba(58,123,213,.08),transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(201,168,76,.06),transparent 60%),var(--bg)}
.login-card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:36px 32px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.login-brand{text-align:center;margin-bottom:28px}
.login-brand h1{font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--gold);margin-bottom:4px}
.login-brand p{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.15em}
.form-group{margin-bottom:18px}
.form-group label{display:block;font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:600}
.form-group input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;transition:border-color .2s;box-sizing:border-box}
.form-group input:focus{border-color:var(--gold-dim)}
.form-group input::placeholder{color:var(--muted)}
.error-msg{background:rgba(224,82,82,.12);border:1px solid rgba(224,82,82,.3);color:var(--red);padding:8px 12px;border-radius:8px;font-size:.82rem;margin-bottom:14px;text-align:center}
.login-btn{width:100%;padding:12px;background:linear-gradient(135deg,var(--gold),var(--gold-dim));border:none;border-radius:10px;color:#0d1117;font-family:'DM Sans',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.login-btn:hover:not(:disabled){box-shadow:0 6px 20px rgba(201,168,76,.3);transform:translateY(-1px)}
.login-btn:disabled{opacity:.7;cursor:not-allowed}
.btn-spinner{width:18px;height:18px;border:2px solid rgba(13,17,23,.3);border-top-color:#0d1117;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.back-link{display:block;text-align:center;margin-top:18px;color:var(--muted);font-size:.82rem;text-decoration:none;transition:color .15s}
.back-link:hover{color:var(--gold-light)}
`;
