import React, { useEffect, useState } from 'react';
import API from '../../../api';
import './Password.css';

const Password = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editPwd, setEditPwd] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const startEdit = (u) => {
    setEditingId(u._id);
    setEditPwd(u.password || '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditPwd('');
  };
  const savePwd = async (id) => {
    try {
      setError('');
      if (!editPwd || editPwd.trim().length < 3) {
        setError('Password must be at least 3 characters');
        return;
      }
      await API.put(`/auth/users/${id}`, { password: editPwd });
      setMessage('Password updated');
      setTimeout(() => setMessage(''), 1500);
      cancelEdit();
      fetchUsers();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update password';
      setError(msg);
    }
  };

  return (
    <div className="pwd-page">
      <div className="pwd-header">
        <h2 className="pwd-title">Passwords</h2>
        <div className="pwd-sub">View and edit user passwords</div>
      </div>
      {error && <div className="pwd-alert error">{error}</div>}
      {message && <div className="pwd-alert success">{message}</div>}

      <div className="pwd-table-wrap">
        <table className="pwd-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Username</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="pwd-empty">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="pwd-empty">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td>{u.role}</td>
                  <td>{u.username}</td>
                  <td>
                    {editingId === u._id ? (
                      <input
                        className="pwd-input"
                        type="text"
                        value={editPwd}
                        onChange={(e) => setEditPwd(e.target.value)}
                      />
                    ) : (
                      <span className="pwd-mono">{u.password}</span>
                    )}
                  </td>
                  <td className="pwd-actions">
                    {editingId === u._id ? (
                      <>
                        <button className="pwd-btn save" onClick={() => savePwd(u._id)}>Save</button>
                        <button className="pwd-btn cancel" onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <button className="pwd-btn edit" onClick={() => startEdit(u)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Password;
