import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const CustomerConfirm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const fromState = state || {};
  const fallback = useMemo(() => {
    try {
      if (!id) return null;
      const saved = sessionStorage.getItem(`token:${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  }, [id]);
  const token = fromState.token ?? fallback?.token;
  const counter = fromState.counter ?? fallback?.counter;
  const date = fromState.date ?? fallback?.date;
  const services = fromState.services ?? fallback?.services ?? [];
  const eta = fromState.eta_time ?? fallback?.eta_time;

  if (!token || !counter) {
    return (
      <div style={{ padding: 24 }}>
        <p>Missing confirmation data. Please start again.</p>
        <button onClick={() => navigate("/customer")}>Start Over</button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0b1222 0%, #0e1a33 100%)",
        color: "#e5e7eb",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), #0f172a",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Your Token</h1>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "linear-gradient(180deg,#dbeafe 0%, #eff6ff 100%)",
            color: "#0f172a",
            fontSize: 20,
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {token}
        </div>
        <div style={{ marginTop: 12 }}>
          <div>
            <strong>Counter:</strong>{" "}
            {counter?.countername || counter?.counterid}
          </div>
          <div>
            <strong>Date:</strong> {date}
          </div>
          {eta && (
            <div>
              <strong>Arrival time:</strong> {eta}
            </div>
          )}
          <div>
            <strong>Services:</strong> {services.join(", ")}
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            ◀ Back
          </button>
          <button
            onClick={() => navigate("/customer")}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerConfirm;
