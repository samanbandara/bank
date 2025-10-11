import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./AdminNavbar.css";

const Admin = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const handleLogout = () => {
    // Clear auth state
    try {
      localStorage.removeItem("authUser");
    } catch (_) {}
    navigate("/");
  };
  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
      <nav className="admin-nav">
        <div className="admin-brand">Admin</div>
        <button
          className="admin-burger"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="admin-links"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          ☰
        </button>
        <div id="admin-links" className={`admin-links${open ? " open" : ""}`}>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="counters"
            onClick={() => setOpen(false)}
          >
            Counters
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="queue"
            onClick={() => setOpen(false)}
          >
            Queue
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="services"
            onClick={() => setOpen(false)}
          >
            Services
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="password"
            onClick={() => setOpen(false)}
          >
            Password
          </NavLink>
          <button
            className="admin-logout"
            onClick={() => {
              setOpen(false);
              handleLogout();
            }}
          >
            Logout
          </button>
        </div>
      </nav>
      <div className="admin-outlet">
        <Outlet />
      </div>
    </div>
  );
};

export default Admin;
