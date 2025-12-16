import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api";

const CustomerServices = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]); // store serviceid strings (e.g., 'sv01')
  const [limitMsg, setLimitMsg] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await API.get("/services");
        let list = res?.data?.services || [];
        list = list.sort((a, b) =>
          String(a.servicename || "").localeCompare(
            String(b.servicename || ""),
            undefined,
            { sensitivity: "base" }
          )
        );
        if (active) setServices(list);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load services"
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = (sid) => {
    setSelectedIds((prev) => {
      // If already selected, unselect it
      if (prev.includes(sid)) {
        setLimitMsg("");
        return prev.filter((x) => x !== sid);
      }
      // Add new selection; if exceeds 2, drop the oldest to keep the last two
      if (prev.length >= 2) {
        setLimitMsg("You can select up to two services.");
        // Keep the last selection and the new one (drop the first/oldest)
        const lastTwo = [prev[1], sid];
        return lastTwo;
      }
      setLimitMsg("");
      return [...prev, sid];
    });
  };

  const canContinue = useMemo(() => selectedIds.length > 0, [selectedIds]);

  const proceed = () => {
    const selectedServices = services.filter((s) => selectedIds.includes(s.serviceid));

    if (selectedIds.length === 2) {
      navigate(`/customer/${id}/order`, {
        state: {
          services: selectedIds,
          selectedServices,
        },
      });
      return;
    }

    navigate(`/customer/${id}/date`, {
      state: { services: selectedIds, selectedServices },
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0b1222 0%, #0e1a33 100%)",
        padding: "16px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#e5e7eb",
          }}
        >
          <h1 style={{ marginBottom: 8, marginTop: 6, fontSize: 22 }}>
            Select Services
          </h1>
          <div style={{ color: "#94a3b8" }}>
            ID: <strong style={{ color: "#e5e7eb" }}>{id}</strong>
          </div>
        </div>
        <p style={{ color: "#94a3b8", marginTop: 0 }}>
          Choose up to two services.
        </p>

        {loading && <div style={{ color: "#e5e7eb" }}>Loading services...</div>}
        {error && (
          <div
            style={{
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
        {limitMsg && !error && (
          <div
            style={{
              color: "#fbbf24",
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.35)",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {limitMsg}
          </div>
        )}

        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            {services.map((s) => {
              const isSelected = selectedIds.includes(s.serviceid);
              return (
                <button
                  key={s._id}
                  onClick={() => toggle(s.serviceid)}
                  style={{
                    textAlign: "center",
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
                    height: 110,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "clamp(0.95rem, 1.2vw + 0.2rem, 1.1rem)",
                    }}
                  >
                    {s.servicename}
                    {s.average_minutes !== undefined && (
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          opacity: 0.8,
                          marginTop: 6,
                        }}
                      >
                        ~{s.average_minutes} min
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
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
            Back
          </button>
          <button
            onClick={proceed}
            disabled={!canContinue}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: canContinue
                ? "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)"
                : "#475569",
              color: "white",
              cursor: canContinue ? "pointer" : "not-allowed",
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

export default CustomerServices;
