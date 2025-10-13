import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../../../api";
import "./Counters.css";
import "./Services.css";
import "./Queue.css";

const Queue = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [counters, setCounters] = useState([]);
  const [saving, setSaving] = useState(""); // holds customer _id while saving
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showCal, setShowCal] = useState(false);
  const calWrapRef = useRef(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-11
  const [counterFilter, setCounterFilter] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState("asc");
  const [editingId, setEditingId] = useState("");
  const [editCounter, setEditCounter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [resCustomers, resCounters] = await Promise.all([
          API.get(`/customers`, {
            params: {
              page,
              limit,
              q,
              date: dateFilter,
              counterid: counterFilter,
              sort,
              dir,
            },
          }),
          API.get("/counters"),
        ]);
        const list = resCustomers?.data?.customers || [];
        const cList = resCounters?.data?.counters || [];
        if (active) {
          setRows(list);
          setCounters(cList);
          setTotal(Number(resCustomers?.data?.total || 0));
        }
      } catch (e) {
        if (active)
          setError(
            e?.response?.data?.message ||
              e.message ||
              "Failed to load customers"
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, limit, q, dateFilter, counterFilter, sort, dir]);

  // Close calendar when clicking outside
  useEffect(() => {
    if (!showCal) return;
    const handleDocMouseDown = (e) => {
      if (calWrapRef.current && !calWrapRef.current.contains(e.target)) {
        setShowCal(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowCal(false);
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showCal]);

  const counterOptions = useMemo(
    () =>
      counters.map((c) => ({
        id: c.counterid,
        name: c.countername || c.counterid,
      })),
    [counters]
  );

  const changeCounter = async (customerId, newCounterId) => {
    try {
      setSaving(customerId);
      const res = await API.put(`/customers/${customerId}/counter`, {
        counterid: newCounterId,
      });
      if (res?.data?.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r._id === customerId
              ? {
                  ...r,
                  counterid: res.data.counter.counterid,
                  countername: res.data.counter.countername,
                }
              : r
          )
        );
      }
    } catch (e) {
      alert(
        e?.response?.data?.message || e.message || "Failed to update counter"
      );
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="ctr-page">
      <div className="svc-header">
        <h2 className="svc-title">Queue</h2>
        <div className="svc-sub">Manage queue</div>
      </div>
      {/*<div className="svc-sub" style={{ marginBottom: 8 }}>Total: {total}</div>
       Controls */}
      <div className="queue-controls">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search token or customer ID"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="queue-input"
        />

        {/* Mobile-only: toggle to show/hide filters */}
        <button
          type="button"
          className="queue-filters-toggle ctr-edit-btn"
          aria-expanded={showFilters}
          aria-controls="queue-filters"
          onClick={() =>
            setShowFilters((prev) => {
              const next = !prev;
              if (!next) setShowCal(false);
              return next;
            })
          }
        >
          {showFilters ? "Hide filters" : "Show filters"}
        </button>

        {/* Filters group: visible on desktop, collapsible on mobile */}
        <div id="queue-filters" className={`queue-filters ${showFilters ? "open" : ""}`}>
          {/* Calendar date filter */}
          <div className="queue-cal-wrap" ref={calWrapRef}>
            <button
              className="ctr-cancel-btn"
              type="button"
              onClick={() => setShowCal((v) => !v)}
            >
              {dateFilter ? `Date: ${dateFilter}` : "Pick date"}
            </button>
            {showCal && (
              <div className="queue-cal-popover">
                <Calendar
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  setViewYear={setViewYear}
                  setViewMonth={setViewMonth}
                  onPick={(y, m, d) => {
                    const mm = String(m + 1).padStart(2, "0");
                    const dd = String(d).padStart(2, "0");
                    const val = `${y}-${mm}-${dd}`;
                    setDateFilter(val);
                    setPage(1);
                    setShowCal(false);
                  }}
                />
              </div>
            )}
          </div>
          <select
            value={counterFilter}
            onChange={(e) => {
              setPage(1);
              setCounterFilter(e.target.value);
            }}
            className="queue-select"
          >
            <option value="">All counters</option>
            {counters.map((c) => (
              <option key={c.counterid} value={c.counterid}>
                {c.countername || c.counterid}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(parseInt(e.target.value, 10));
            }}
            className="queue-select"
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
            className="queue-select"
          >
            <option value="createdAt">Newest</option>
            <option value="date">Date</option>
            <option value="token">Token</option>
            <option value="userid">Customer ID</option>
            <option value="counterid">Counter</option>
          </select>
          <select
            value={dir}
            onChange={(e) => {
              setPage(1);
              setDir(e.target.value);
            }}
            className="queue-select"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <button
            className="ctr-cancel-btn"
            onClick={() => {
              setQ("");
              setDateFilter("");
              setCounterFilter("");
              setSort("createdAt");
              setDir("asc");
              setShowCal(false);
              setPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="ctr-alert">{error}</div>}
      {!loading && !error && (
        <div className="queue-cards">
          {rows.map((r) => (
            <div key={r._id} className="queue-card">
              <div className="queue-card-row">
                <div>
                  <div className="queue-label">Token</div>
                  <div className="queue-token">
                    {r.token}
                  </div>
                </div>
                <div>
                  <div className="queue-label">Date</div>
                  <div>{r.date}</div>
                </div>
                <div>
                  <div className="queue-label">Customer</div>
                  <div>{r.userid}</div>
                </div>
                <div className="queue-counter-col">
                  <div className="queue-label">Counter</div>
                  {editingId === r._id ? (
                    <div className="inline-row">
                      <select
                        value={editCounter}
                        onChange={(e) => setEditCounter(e.target.value)}
                        disabled={!!saving}
                        className="queue-edit-select"
                      >
                        {counterOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ctr-edit-btn"
                        disabled={!!saving}
                        onClick={async () => {
                          await changeCounter(r._id, editCounter);
                          setEditingId("");
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="ctr-cancel-btn"
                        disabled={!!saving}
                        onClick={() => {
                          setEditingId("");
                          setEditCounter("");
                        }}
                      >
                        Cancel
                      </button>
                      {saving === r._id && (
                        <span className="queue-saving">Saving…</span>
                      )}
                    </div>
                  ) : (
                    <div className="inline-row">
                      <div className="queue-chip">
                        {r.countername || r.counterid}
                      </div>
                      <button
                        className="ctr-edit-btn"
                        onClick={() => {
                          setEditingId(r._id);
                          setEditCounter(r.counterid);
                        }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="queue-label">Services</div>
                <div className="queue-services">
                  {(r.serviceNames && r.serviceNames.length
                    ? r.serviceNames
                    : r.services
                  ).map((name, idx) => (
                    <span key={idx} className="queue-chip-pill">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="queue-empty">No customers yet.</div>
          )}
        </div>
      )}
      {/* Pagination */}
      <div className="queue-pagination">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="ctr-cancel-btn"
        >
          Prev
        </button>
        <span className="queue-pagination-info">
          Page {page} of {Math.max(1, Math.ceil(total / limit))}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={rows.length < limit}
          className="ctr-edit-btn"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// Compact calendar used for filtering (allows all dates)
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Calendar({ viewYear, viewMonth, setViewYear, setViewMonth, onPick }) {
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday-first
  const totalDays = daysInMonth(viewYear, viewMonth);

  const goPrev = () => {
    let m = viewMonth - 1,
      y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };
  const goNext = () => {
    let m = viewMonth + 1,
      y = viewYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++)
    cells.push(<div key={`e-${i}`} className="cal-spacer" />);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(
      <button
        key={`d-${d}`}
        onClick={() => onPick(viewYear, viewMonth, d)}
        className="cal-cell"
      >
        {d}
      </button>
    );
  }

  return (
    <div>
      <div className="cal-nav">
        <button className="ctr-cancel-btn" type="button" onClick={goPrev}>
          ◀
        </button>
        <div className="cal-title">
          {monthNames[viewMonth]} {viewYear}
        </div>
        <button className="ctr-edit-btn" type="button" onClick={goNext}>
          ▶
        </button>
      </div>
      <div className="cal-grid">
        {weekdayHeaders.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

export default Queue;
