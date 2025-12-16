import React, { useEffect, useState } from "react";
import API from "../../../api";
import "./Services.css";

const daysDefault = [
  { dayIndex: 0, dayName: "Monday" },
  { dayIndex: 1, dayName: "Tuesday" },
  { dayIndex: 2, dayName: "Wednesday" },
  { dayIndex: 3, dayName: "Thursday" },
  { dayIndex: 4, dayName: "Friday" },
  { dayIndex: 5, dayName: "Saturday" },
  { dayIndex: 6, dayName: "Sunday" },
];

const BankOpening = () => {
  const [days, setDays] = useState(() =>
    daysDefault.map((d) => ({ ...d, open: true, openTime: "09:00", closeTime: "17:00" }))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await API.get("/bank-schedule");
        const list = res?.data?.schedule?.days || [];
        const normalized = daysDefault.map((d) => {
          const match = list.find((x) => Number(x.dayIndex) === d.dayIndex) || {};
          return {
            ...d,
            open: Boolean(match.open ?? true),
            openTime: match.openTime || "09:00",
            closeTime: match.closeTime || "17:00",
          };
        });
        setDays(normalized);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateDay = (idx, patch) => {
    setDays((prev) => prev.map((d) => (d.dayIndex === idx ? { ...d, ...patch } : d)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // simple validation: if open, times required
    for (const d of days) {
      if (d.open && (!d.openTime || !d.closeTime)) {
        setError(`Please set open/close times for ${d.dayName}`);
        return;
      }
    }

    try {
      setSaving(true);
      await API.put("/bank-schedule", { days });
      setMessage("Schedule saved");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="svc-page">
      <div className="svc-header">
        <h2 className="svc-title">Bank Opening</h2>
        <div className="svc-sub">Set opening/closing times for each day</div>
      </div>

      {error && <div className="svc-alert error">{error}</div>}
      {message && <div className="svc-alert success">{message}</div>}

      <form onSubmit={handleSave} className="svc-form" style={{ flexWrap: "wrap" }}>
        <div style={{ width: "100%", display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {days.map((d) => (
            <div
              key={d.dayIndex}
              style={{
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(15,23,42,0.55)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong>{d.dayName}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={d.open}
                    onChange={(e) => updateDay(d.dayIndex, { open: e.target.checked })}
                  />
                  Open
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Opens</label>
                  <input
                    className="svc-input"
                    type="time"
                    style={{ width: "100%", minWidth: 0 }}
                    value={d.openTime}
                    disabled={!d.open}
                    onChange={(e) => updateDay(d.dayIndex, { openTime: e.target.value })}
                  />
                </div>
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Closes</label>
                  <input
                    className="svc-input"
                    type="time"
                    style={{ width: "100%", minWidth: 0 }}
                    value={d.closeTime}
                    disabled={!d.open}
                    onChange={(e) => updateDay(d.dayIndex, { closeTime: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="svc-button" type="submit" disabled={saving || loading}>
          {saving ? "Saving..." : "Save Schedule"}
        </button>
      </form>
    </div>
  );
};

export default BankOpening;