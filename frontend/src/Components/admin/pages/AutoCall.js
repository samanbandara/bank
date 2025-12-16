import React, { useEffect, useState } from "react";
import API from "../../../api";
import "./AutoCall.css";
import "./Services.css"; // reuse header styles

const formatRssi = (rssi) => {
  if (rssi === null || rssi === undefined || rssi === "") return "N/A";
  return `${rssi} dBm`;
};

const valueOrNA = (value) => (value === 0 ? "0" : value ? value : "N/A");

const parseDeviceTimestamp = (d) => {
  if (!d) return null;
  const datePart = d.generated_date || d.generatedDate;
  const timePart = d.generated_time || d.generatedTime;
  const candidates = [];
  if (datePart && timePart) candidates.push(`${datePart}T${timePart}`);
  if (datePart && timePart) candidates.push(`${datePart} ${timePart}`);
  if (d.generated_time) candidates.push(d.generated_time);
  if (d.createdAt) candidates.push(d.createdAt);
  for (const c of candidates) {
    const ts = Date.parse(c);
    if (!Number.isNaN(ts)) return ts;
  }
  return null;
};

const latestDeviceTimestamp = (list) => {
  let latest = null;
  for (const item of list || []) {
    const ts = parseDeviceTimestamp(item);
    if (ts && (!latest || ts > latest)) latest = ts;
  }
  return latest;
};

const formatAgo = (ms) => {
  if (ms <= 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const deviceStatus = (d) => {
  const ts = parseDeviceTimestamp(d);
  if (!ts) return { label: "No timestamp", className: "ac-status offline" };
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return { label: "Online", className: "ac-status online" };
  return { label: `Last seen ${formatAgo(diff)} ago`, className: "ac-status offline" };
};

const hasListChanged = (prev, next) => JSON.stringify(prev) !== JSON.stringify(next);

const AutoCall = () => {
  const [deviceData, setDeviceData] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [smsList, setSmsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = async (opts = {}) => {
    const { silent = false } = opts;
    setError("");
    if (!silent) setLoading(true);
    try {
      const [dataRes, logRes, smsRes] = await Promise.all([
        API.get("/device_data?limit=1"),
        API.get("/calllogs"),
        API.get("/sms?limit=50"),
      ]);
      const nextDevice = dataRes.data?.device_data || dataRes.data || [];
      const nextLogs = logRes.data?.calllogs || logRes.data || [];
      const nextSms = smsRes.data?.sms || smsRes.data || [];

      if (hasListChanged(deviceData, nextDevice)) setDeviceData(nextDevice);
      if (hasListChanged(callLogs, nextLogs)) setCallLogs(nextLogs);
      if (hasListChanged(smsList, nextSms)) setSmsList(nextSms);
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to load device data, call logs, or SMS";
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDeleteSms = async (sms) => {
    const id = sms?._id || sms?.id;
    if (!id) return;
    setError("");
    try {
      await API.delete(`/sms/${id}`);
      await fetchAll();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to delete SMS";
      setError(msg);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetchAll({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ac-page">
      <div className="svc-header">
        <h2 className="svc-title">Auto Call</h2>
        <div className="svc-sub">Manage ESP32 + SIM800 calling device</div>
      </div>

      {error && <div className="ac-alert">{error}</div>}

      <div className="ac-toolbar">
        <button className="ac-refresh" onClick={fetchAll} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="ac-split">
        <div className="ac-column">
          <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            </div>
          </div>
          <div className="ac-list">
            {loading ? (
              <>
                <div className="ac-item ac-skel" />
                <div className="ac-item ac-skel" />
                <div className="ac-item ac-skel" />
              </>
            ) : deviceData.length ? (
              deviceData.map((d) => {
                const key = d._id || d.id || `${d.device_name}-${d.generated_time}`;
                const twoG = d["2g"] || {};
                const wifi = d.wifi || {};
                const itemStatus = deviceStatus(d);
                return (
                  <div className="ac-item" key={key}>
                    <div className="ac-item-head">
                      <div className="ac-item-title">{d.device_name || "Unknown device"}</div>
                      <span className={itemStatus.className}>{itemStatus.label}</span>
                    </div>
                    <div className="ac-subgrid">
                      <div className="ac-subpanel">
                        <div className="ac-subtitle">Local network (2G)</div>
                        <div className="ac-row">
                          <span className="ac-label">SIM</span>
                          <span className="ac-value">{valueOrNA(twoG.sim)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">Operator</span>
                          <span className="ac-value">{valueOrNA(twoG.operator)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">Voice</span>
                          <span className="ac-value">{valueOrNA(twoG.voice)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">Data</span>
                          <span className="ac-value">{valueOrNA(twoG.data)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">RSSI</span>
                          <span className="ac-value">{formatRssi(twoG.rssi)}</span>
                        </div>
                      </div>

                      <div className="ac-subpanel">
                        <div className="ac-subtitle">WiFi</div>
                        <div className="ac-row">
                          <span className="ac-label">SSID</span>
                          <span className="ac-value">{valueOrNA(wifi.ssid)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">WiFi RSSI</span>
                          <span className="ac-value">{valueOrNA(wifi.rssi)}</span>
                        </div>
                        <div className="ac-row">
                          <span className="ac-label">IP</span>
                          <span className="ac-value">{valueOrNA(wifi.ip)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ac-empty">No device data yet</div>
            )}
          </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>SMS</h3>
            </div>
            <div className="ac-list">
              {loading ? (
                <>
                  <div className="ac-item ac-skel" />
                  <div className="ac-item ac-skel" />
                </>
              ) : smsList.length ? (
                smsList.map((s) => {
                  const key = s._id || s.id || `${s.sender}-${s.received_time}`;
                  return (
                    <div className="ac-item" key={key}>
                      <div className="ac-item-head">
                        <div className="ac-item-title">{valueOrNA(s.sender)}</div>
                        <div className="ac-item-meta">{valueOrNA(s.received_time)}</div>
                      </div>
                      {s.message ? <div className="ac-text">{s.message}</div> : <div className="ac-text muted">No message body</div>}
                      <div className="ac-actions">
                        <button className="ac-btn ac-btn-danger" onClick={() => handleDeleteSms(s)} disabled={loading}>
                          Delete SMS
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ac-empty">No SMS yet</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Call log</h3>
          </div>
          <div className="ac-list">
            <div className="ac-item ac-headitem">
              <div className="ac-call-row ac-headrow">
                <span className="ac-value">Phone</span>
                <span className="ac-value">ID</span>
                <span className="ac-value">Date</span>
                <span className="ac-value">Time</span>
              </div>
            </div>
            {loading ? (
              <>
                <div className="ac-item ac-skel" />
                <div className="ac-item ac-skel" />
                <div className="ac-item ac-skel" />
              </>
            ) : callLogs.length ? (
              callLogs.map((c) => {
                const key = c._id || c.id || `${c.phone_number}-${c.time}`;
                return (
                  <div className="ac-item" key={key}>
                    <div className="ac-call-row">
                      <span className="ac-value">{valueOrNA(c.phone_number)}</span>
                      <span className="ac-value">{valueOrNA(c.id_number)}</span>
                      <span className="ac-value">{valueOrNA(c.date)}</span>
                      <span className="ac-value">{valueOrNA(c.time)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ac-empty">No call log entries yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoCall;
