import React, { useEffect, useMemo, useState } from "react";
import API from "../../../api";
import "./Buttons.css";
import "./Services.css"; // for shared header styles

// Small helpers to be resilient to backend field naming
const pickName = (d) => d.devicename || d.deviceName || d.deviceid || d.deviceId || d._id || "Unnamed";
const pickId = (d) => d._id || d.deviceId || d.deviceid || d.id || pickName(d);
const pickOnline = (d) => (typeof d.online === "boolean" ? d.online : (d.status === "online"));
const pickAssignedCounterId = (d) => d.assignedCounterId || d.counterId || d.counterid || d.assignedCounter || d.counter;

const Buttons = () => {
  const [devices, setDevices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const counterOptions = useMemo(
    () => counters.map((c) => ({ id: c._id || c.counterid || c.countername, label: c.countername || c.counterid })),
    [counters]
  );

  const fetchAll = async () => {
    setError("");
    setLoading(true);
    try {
      const [btnRes, ctrRes] = await Promise.all([
        API.get("/buttons"),
        API.get("/counters"),
      ]);
      setDevices(btnRes.data?.devices || btnRes.data?.buttons || []);
      setCounters(ctrRes.data?.counters || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load buttons or counters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const updateDevice = async (deviceId, patch) => {
    setError("");
    try {
      await API.put(`/buttons/${deviceId}`,
        patch
      );
      await fetchAll();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to update device";
      setError(msg);
    }
  };

  const handleToggle = async (d) => {
    const id = pickId(d);
    const next = !pickOnline(d);
    await updateDevice(id, { online: next });
  };

  const handleAssign = async (d, value) => {
    const id = pickId(d);
    const body = { assignedCounterId: value || null };
    await updateDevice(id, body);
  };

  return (
    <div className="btn-page">
      <div className="svc-header">
        <h2 className="svc-title">Buttons</h2>
        <div className="svc-sub">Manage ESP32 button devices and assignments</div>
      </div>

      {error && <div className="btn-alert">{error}</div>}

      <div className="btn-toolbar">
        <button className="btn-refresh" onClick={fetchAll} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="btn-grid">
        {loading ? (
          <>
            <div className="btn-card btn-skel" />
            <div className="btn-card btn-skel" />
            <div className="btn-card btn-skel" />
          </>
        ) : (
          devices.map((d) => {
            const id = pickId(d);
            const name = pickName(d);
            const online = pickOnline(d);
            const assigned = pickAssignedCounterId(d) || "";
            return (
              <div className="btn-card" key={id}>
                <div className="btn-headline">
                  <div className="btn-avatar">{String(name).charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="btn-title">{name}</div>
                    <div className={`btn-status ${online ? "on" : "off"}`}>
                      {online ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>

                <div className="btn-field">
                  <label htmlFor={`ctr-${id}`}>Assigned counter</label>
                  <select
                    id={`ctr-${id}`}
                    value={assigned}
                    onChange={(e) => handleAssign(d, e.target.value)}
                  >
                    <option value="">— Not assigned —</option>
                    {counterOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="btn-actions">
                  <button className="btn-toggle" onClick={() => handleToggle(d)}>
                    {online ? "Turn Off" : "Turn On"}
                  </button>
                </div>
              </div>
            );
          })
        )}

        {!loading && devices.length === 0 && (
          <div className="btn-empty">No button devices found</div>
        )}
      </div>
    </div>
  );
};

export default Buttons;
