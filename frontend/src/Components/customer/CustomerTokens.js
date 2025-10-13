import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api";

const PAGE_SIZE = 10;

const CustomerTokens = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => `^${encodeURIComponent(id || "")}`, [id]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const parseCounterNum = (v) => {
    const s = String(v ?? "");
    const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
  };

  const sortAndFilter = (arr) => {
    // Remove expired (date < today)
    const filtered = arr.filter((c) => String(c.date || "") >= todayStr);
    // Oldest first (date asc), then by counter number asc, then by token asc
    return filtered.sort((a, b) => {
      const d = String(a.date || "").localeCompare(String(b.date || ""));
      if (d !== 0) return d;
      const ca = parseCounterNum(a.counterid);
      const cb = parseCounterNum(b.counterid);
      if (ca !== cb) return ca - cb;
      return String(a.token || "").localeCompare(String(b.token || ""));
    });
  };

  const load = async (p = 1) => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/customers", {
        params: {
          page: p,
          limit: PAGE_SIZE,
          q: query,
          // Request server to sort by date ascending (oldest first)
          sort: "date",
          dir: "asc",
        },
      });
      const data = res?.data || {};
      const list = data.customers || [];
      setItems((prev) => sortAndFilter(p === 1 ? list : [...prev, ...list]));
      setPage(data.page || p);
      setPages(data.pages || 1);
    } catch (e) {
      setError(
        e?.response?.data?.message || e.message || "Failed to load tokens"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    setPage(1);
    setPages(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const viewToken = (c) => {
    try {
      const payload = {
        token: c.token,
        counter: { counterid: c.counterid, countername: c.countername },
        date: c.date,
        services: c.services || [],
      };
      sessionStorage.setItem(`token:${id}`, JSON.stringify(payload));
      navigate(`/customer/${id}/confirm`, { state: payload });
    } catch (_) {
      navigate(`/customer/${id}/confirm`);
    }
  };

  return (
    <div className="customer-page">
      <div className="customer-card">
        <h1 className="customer-title">Your Tokens</h1>
        <p className="customer-subtitle">ID: {id}</p>

        {error && (
          <div className="customer-error" role="alert">
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {items.length === 0 && !loading && (
            <div style={{ color: "#94a3b8" }}>No tokens found.</div>
          )}
          {items.map((c) => (
            <div
              key={c._id}
              style={{
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: 10,
                padding: 12,
                background: "rgba(17,24,39,0.6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>Token: {c.token}</div>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>
                    Date: {c.date}
                  </div>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>
                    Counter: {c.countername}
                  </div>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>
                    Services:{" "}
                    {(c.serviceNames && c.serviceNames.length
                      ? c.serviceNames
                      : c.services || []
                    ).join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button
                    className="customer-button"
                    onClick={() => viewToken(c)}
                    style={{ padding: "10px 12px" }}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="customer-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="customer-button secondary"
            onClick={() => navigate(-1)}
          >
            ◀ Back
          </button>
          <button
            type="button"
            className="customer-button secondary"
            onClick={() => load(page + 1)}
            disabled={loading || page >= pages}
          >
            {loading ? "Loading…" : page < pages ? "Load more" : "No more"}
          </button>
          <button
            type="button"
            className="customer-button"
            onClick={() => navigate(`/customer/${id}/services`)}
          >
            New token ➜
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerTokens;
