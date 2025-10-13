import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../../api";
import "./customerDate.css";

const formatLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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

const CustomerDate = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const services = (location.state && location.state.services) || [];

  const today = useMemo(() => new Date(), []);
  const todayMid = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selected, setSelected] = useState(null); // Date

  const goPrevMonth = () => {
    const curKey = today.getFullYear() * 12 + today.getMonth();
    const viewKey = viewYear * 12 + viewMonth;
    if (viewKey <= curKey) return;
    let m = viewMonth - 1,
      y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };
  const goNextMonth = () => {
    let m = viewMonth + 1,
      y = viewYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  // Monday-first start index
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 Mon ... 6 Sun
  const totalDays = daysInMonth(viewYear, viewMonth);

  const isDisabled = (y, m, d) => {
    const dt = new Date(y, m, d);
    const notFuture = dt <= todayMid; // today and past disabled
    const day = dt.getDay();
    const isWeekend = day === 0 || day === 6; // Sun or Sat
    return notFuture || isWeekend;
  };

  const pick = (y, m, d) => {
    if (isDisabled(y, m, d)) return;
    setSelected(new Date(y, m, d));
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const proceed = async () => {
    if (!selected || submitting) return;
    const dateStr = formatLocalDate(selected);
    try {
      setSubmitting(true);
      setError("");
      const res = await API.post("/customers", {
        userid: id,
        date: dateStr,
        services,
      });
      const data = res?.data;
      if (data?.ok) {
        // Persist minimal details so they can be reopened from Customer page later
        try {
          const payload = {
            token: data.token,
            counter: data.counter,
            date: dateStr,
            services,
          };
          sessionStorage.setItem(`token:${id}`, JSON.stringify(payload));
        } catch (_) {}
        navigate(`/customer/${id}/confirm`, {
          state: {
            token: data.token,
            counter: data.counter,
            date: dateStr,
            services,
          },
        });
      } else {
        throw new Error(data?.message || "Failed to create ticket");
      }
    } catch (e) {
      setError(
        e?.response?.data?.message || e.message || "Failed to create ticket"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const weekRow = (
    <div className="date-week-row">
      {weekdayHeaders.map((w) => (
        <div key={w} className="date-week-cell">
          {w}
        </div>
      ))}
    </div>
  );

  const renderGrid = () => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++)
      cells.push(<div key={`empty-${i}`} />);
    for (let d = 1; d <= totalDays; d++) {
      const disabled = isDisabled(viewYear, viewMonth, d);
      const isSel = !!(
        selected &&
        selected.getFullYear() === viewYear &&
        selected.getMonth() === viewMonth &&
        selected.getDate() === d
      );
      cells.push(
        <button
          key={`d-${d}`}
          disabled={disabled}
          onClick={() => pick(viewYear, viewMonth, d)}
          className={`date-cell ${disabled ? "disabled" : ""} ${
            isSel ? "selected" : ""
          }`}
        >
          {d}
        </button>
      );
    }
    return <div className="date-grid-inner">{cells}</div>;
  };

  const prevDisabled =
    viewYear * 12 + viewMonth <= today.getFullYear() * 12 + today.getMonth();

  return (
    <div className="date-page">
      <div className="date-card">
        <h1 className="date-title">Choose Date</h1>
        <p className="date-subtitle">
          Select any future date (today is disabled).
        </p>

        <div className="date-nav">
          <button
            onClick={goPrevMonth}
            disabled={prevDisabled}
            className="date-nav-btn"
          >
            ◀ Prev
          </button>
          <div className="date-month">
            {monthNames[viewMonth]} {viewYear}
          </div>
          <button onClick={goNextMonth} className="date-nav-btn">
            Next ▶
          </button>
        </div>

        <div className="date-week">{weekRow}</div>
        <div className="date-grid">{renderGrid()}</div>

        {error && (
          <div
            style={{
              marginTop: 10,
              color: "#fecaca",
              background: "#7f1d1d",
              border: "1px solid #fecaca",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div className="date-footer">
          <button onClick={() => navigate(-1)} className="date-btn secondary">
            Back
          </button>
          <button
            onClick={proceed}
            disabled={!selected || submitting}
            className={`date-btn primary ${
              !selected || submitting ? "disabled" : ""
            }`}
          >
            {submitting ? "Submitting…" : "Continue ➜"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDate;
