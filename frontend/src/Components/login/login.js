import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api';
import './login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const name = (username || '').trim();
    const pwd = (password || '').trim();
    if (!name || !pwd) {
      setError('Please enter both username and password.');
      return;
    }
    try {
      setLoading(true);
  const res = await API.post('/auth/login', { username: name, password: pwd });
      const data = res.data;
      if (data?.ok) {
        // Persist minimal auth state for route guard
        const authUser = { username: data.username || name, role: (data.role || (name.toLowerCase()==='admin'?'admin':'counter')) };
        localStorage.setItem('authUser', JSON.stringify(authUser));
        if (String(authUser.role).toLowerCase() === 'admin') {
          navigate('/admin');
        } else {
          navigate(`/user/${encodeURIComponent(authUser.username)}`);
        }
      } else {
        setError(data?.message || 'Login failed');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Bank Queue Management</h1>
        {/* <p className="login-subtitle">Sign in as admin or a counter user</p> */}

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="username" className="login-label">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Your username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            className="login-input"
            autoFocus
          />

          <label htmlFor="password" className="login-label" style={{ marginTop: 12 }}>Password</label>
          <input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            className="login-input"
          />

          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>{loading ? 'Signing in...' : 'Continue'}</button>
        </form>

        <div className="login-hint">
          {/*Examples: admin, counter1, counter2*/}
        </div>
      </div>
    </div>
  );
}

export default Login;
