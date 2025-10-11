import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAuth = ({ children, requireRole }) => {
  const location = useLocation();
  let user = null;
  try {
    const raw = localStorage.getItem('authUser');
    user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    user = null;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (requireRole && String(user.role || '').toLowerCase() !== String(requireRole).toLowerCase()) {
    // If role doesn't match, send them to their user page or login
    if (user.username) {
      return <Navigate to={`/user/${encodeURIComponent(user.username)}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAuth;
