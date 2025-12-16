import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./AdminNavbar.css";
import "./admin.css";

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [localAuth, setLocalAuth] = useState(() => {
    try {
      const raw = localStorage.getItem("authUser");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });
  const sectionOrder = ["counters", "queue", "services", "bank-opening", "buttons", "autocall", "password"];
  const getSectionIndex = (pathname) => {
    const m = pathname.match(/\/admin\/?([^/]*)/);
    const seg = m && m[1] ? m[1] : ""; // empty when /admin
    const name = seg || "counters";
    const idx = sectionOrder.indexOf(name);
    return idx === -1 ? 0 : idx;
  };
  const prevIndexRef = useRef(getSectionIndex(location.pathname));
  const curIndex = getSectionIndex(location.pathname);
  const dir = curIndex < prevIndexRef.current ? "from-left" : "from-right";
  useEffect(() => {
    prevIndexRef.current = curIndex;
  }, [curIndex]);
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
        <button
          type="button"
          className="admin-brand"
          title="Click to swap stored username and role"
          onClick={() => {
            if (!localAuth) return;
            const swapped = {
              username: String(localAuth.role || ""),
              role: String(localAuth.username || ""),
            };
            try {
              localStorage.setItem("authUser", JSON.stringify(swapped));
            } catch (_) {}
            setLocalAuth(swapped);
          }}
          style={{ cursor: localAuth ? "pointer" : "default", background: "transparent", border: "none", padding: 0 }}
        >
          Admin
        </button>
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
            to="bank-opening"
            onClick={() => setOpen(false)}
          >
            Bank Opening
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="buttons"
            onClick={() => setOpen(false)}
          >
            Buttons
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `admin-link${isActive ? " active" : ""}`
            }
            to="autocall"
            onClick={() => setOpen(false)}
          >
            Auto Call
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
        <div key={location.pathname} className={`md-slide-enter ${dir}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Admin;
