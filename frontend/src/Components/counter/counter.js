import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api";
import "./counter.css";

// Show only the current token for the logged-in counter (today only).
const CounterDashboard = () => {
  const { name } = useParams(); // counter id (e.g., counter1)
  const navigate = useNavigate();

  const [tokens, setTokens] = useState([]); // array of { token, userid, ... }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateMode, setDateMode] = useState("today"); // fixed to today
  const [buttonDevice, setButtonDevice] = useState(null); // assigned button device

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const activeDate = today;

  const fetchNext = async () => {
    try {
      setError("");
      // Use existing list API, limited to 1 (current) for today for this counter.
      const res = await API.get("/customers", {
        params: {
          date: activeDate,
          counterid: name,
          sort: "createdAt",
          dir: "asc",
          page: 1,
          limit: 1,
        },
      });
      const list = res?.data?.customers || [];
      setTokens(list);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Failed to load tokens";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedButton = async () => {
    try {
      const res = await API.get("/buttons");
      const list = res?.data?.devices || res?.data?.buttons || [];
      // Find device assigned to this counter (resilient field names)
      const dev = list.find((d) => {
        const assigned = d.assignedCounterId || d.counterId || d.counterid || d.assignedCounter || d.counter;
        return assigned === name;
      });
      setButtonDevice(dev || null);
    } catch (err) {
      // Silent ignore; button status not critical
    }
  };

  useEffect(() => {
    fetchNext();
    fetchAssignedButton();
    // Refresh periodically for big screen view (tokens + button status)
    const t = setInterval(() => {
      fetchNext();
      fetchAssignedButton();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, activeDate]);

  const logout = () => {
    try {
      localStorage.removeItem("authUser");
    } catch (_) {}
    navigate("/");
  };

  return (
    <div className="ctr-wrap">
      <header className="ctr-header" style={{ alignItems: "center" }}>
        <div className="ctr-title" style={{ width: "100%", textAlign: "center" }}>
          <span style={{ fontSize: "3.4rem", fontWeight: 700 }}> {name}</span>
          {buttonDevice && (
            <span
              className={`ctr-badge ${
                (typeof buttonDevice.online === "boolean"
                  ? buttonDevice.online
                  : buttonDevice.status === "online")
                  ? "online"
                  : "offline"
              }`}
              style={{ marginLeft: 12 }}
            >
              Button: {(
                (typeof buttonDevice.online === "boolean"
                  ? buttonDevice.online
                  : buttonDevice.status === "online")
              ) ? "Online" : "Offline"}
            </span>
          )}
        </div>
      </header>

      {error && <div className="ctr-error">{error}</div>}

      <main className="ctr-main">
        <section className="ctr-panel">
          <div className="ctr-panel-title">Next token</div>
          {loading ? (
            <div className="ctr-skel-row">
              <div className="ctr-skel-box" />
              <div className="ctr-skel-box small" />
              <div className="ctr-skel-box small" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="ctr-empty">No queued tokens for today</div>
          ) : (
            <div className="ctr-tokens">
              <div className="ctr-token ctr-token-primary">
                <div className="ctr-token-label">Now</div>
                <div className="ctr-token-value">
                  {tokens[0]?.token || "—"}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button
          className="ctr-logout"
          onClick={logout}
          aria-label="Log out"
          style={{ padding: "1px 2px", fontSize: "0.9rem" }}
        >
          X
        </button>
      </div>
    </div>
  );
};

export default CounterDashboard;