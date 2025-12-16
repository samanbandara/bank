import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../../api";

const CustomerServiceOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const services = (location.state && location.state.services) || [];
  const selectedServices = (location.state && location.state.selectedServices) || [];

  const [serviceNames, setServiceNames] = useState(() => {
    const map = new Map();
    selectedServices.forEach((s) => map.set(s.serviceid, s.servicename));
    return map;
  });
  const [first, setFirst] = useState(services[0] || null);
  const [loadingNames, setLoadingNames] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (services.length !== 2) {
      // If not two services, skip to date
      navigate(`/customer/${id}/date`, { state: { services, selectedServices } });
      return;
    }
    // If we already have both names, skip fetch
    if (serviceNames.size === 2) return;

    (async () => {
      try {
        setLoadingNames(true);
        const res = await API.get("/services");
        const list = res?.data?.services || [];
        const map = new Map();
        list.forEach((s) => map.set(s.serviceid, s.servicename));
        setServiceNames(map);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load services");
      } finally {
        setLoadingNames(false);
      }
    })();
  }, [services, serviceNames, id, navigate, selectedServices]);

  const second = services.find((s) => s !== first);

  const continueNext = () => {
    if (!first || !second) return;
    const ordered = [first, second];
    const selectedDetail = ordered.map((sid) => ({
      serviceid: sid,
      servicename: serviceNames.get(sid),
    }));
    navigate(`/customer/${id}/date`, {
      state: {
        services: ordered,
        selectedServices: selectedDetail,
      },
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0b1222 0%, #0e1a33 100%)",
        padding: "16px",
        color: "#e5e7eb",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ marginBottom: 8, marginTop: 6, fontSize: 22 }}>Choose the first service</h1>
          <div style={{ color: "#94a3b8" }}>
            ID: <strong style={{ color: "#e5e7eb" }}>{id}</strong>
          </div>
        </div>
        <p style={{ color: "#94a3b8", marginTop: 0 }}>Pick which one you want to do first.</p>

        {error && (
          <div
            style={{
              color: "#fecaca",
              background: "#7f1d1d",
              border: "1px solid #fecaca",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {services.map((sid) => {
            const name = serviceNames.get(sid) || sid;
            const isSelected = first === sid;
            return (
              <button
                key={sid}
                onClick={() => setFirst(sid)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 14,
                  border: isSelected
                    ? "2px solid #3b82f6"
                    : "1px solid rgba(148,163,184,0.25)",
                  background: isSelected
                    ? "linear-gradient(180deg,#dbeafe 0%, #3d73b9ff 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), #0f172a",
                  color: isSelected ? "#0f172a" : "#e5e7eb",
                  cursor: "pointer",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                  minHeight: 120,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{name}</div>
                <div style={{ marginTop: 6, fontSize: "0.9rem", color: isSelected ? "#0f172a" : "#cbd5e1" }}>
                  {isSelected ? "Will be called first" : "Tap to make this first"}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
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
            Back
          </button>
          <button
            onClick={continueNext}
            disabled={!first || loadingNames}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: !first || loadingNames
                ? "#475569"
                : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: "white",
              cursor: !first || loadingNames ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            Continue ➜
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerServiceOrder;
