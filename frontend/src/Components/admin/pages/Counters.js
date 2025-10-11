import React, { useEffect, useRef, useState } from "react";
// axios removed; using central API client
import API from "../../../api";
import "./Counters.css";

const CounterCard = ({
  countername,
  counterservices = [],
  onDelete,
  onEdit,
  isEditing = false,
  editSelected = [],
  setEditSelected = () => {},
  onSaveEdit = () => {},
  onCancelEdit = () => {},
  servicesOptions = [],
}) => {
  const initial = (countername?.[0] || "C").toUpperCase();
  return (
    <div className="ctr-card">
      <button
        className="ctr-close"
        type="button"
        aria-label="Delete counter"
        title="Delete counter"
        onClick={onDelete}
      >
        ×
      </button>
      <div className="ctr-headline">
        <div className="ctr-avatar">{initial}</div>
        <div>
          <div className="ctr-title">{countername}</div>
          {counterservices.length === 0 && (
            <div className="ctr-sub">No services assigned</div>
          )}
        </div>
      </div>
      {counterservices.length > 0 && (
        <div className="ctr-services-list">
          {counterservices.map((s, idx) => (
            <span key={idx} className="badge">
              {s}
            </span>
          ))}
        </div>
      )}
      {!isEditing && (
        <div className="ctr-actions">
          <button className="ctr-edit-btn" onClick={onEdit}>
            Edit services
          </button>
        </div>
      )}
      {isEditing && (
        <div style={{ marginTop: 8, width: "100%" }}>
          <MultiSelectDropdown
            options={servicesOptions}
            selected={editSelected}
            setSelected={setEditSelected}
            placeholder="Select services"
          />
          <div className="ctr-btn-row">
            <button className="ctr-add-btn" onClick={onSaveEdit}>
              Save
            </button>
            <button className="ctr-add-btn" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({
  options,
  selected,
  setSelected,
  placeholder = "Select services",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const toggle = () => setOpen((v) => !v);
  const isChecked = (name) => selected.includes(name);
  const onToggleItem = (name) => {
    if (isChecked(name)) setSelected(selected.filter((x) => x !== name));
    else setSelected([...selected, name]);
  };

  const label = selected.length === 0 ? placeholder : selected.join(", ");

  return (
    <div className="ctr-msd" ref={ref}>
      <button type="button" className="ctr-msd-toggle" onClick={toggle}>
        <span className="ctr-msd-label">{label}</span>
        <span className="ctr-msd-caret">▾</span>
      </button>
      {open && (
        <div className="ctr-msd-menu">
          {options.map((o) => (
            <label key={o._id} className="ctr-msd-item">
              <input
                type="checkbox"
                checked={isChecked(o.servicename)}
                onChange={() => onToggleItem(o.servicename)}
              />
              <span>{o.servicename}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="ctr-msd-empty">No services available</div>
          )}
        </div>
      )}
    </div>
  );
};

const AddCounterCard = ({
  onAdd,
  loading,
  services,
  selected,
  setSelected,
}) => (
  <div className="ctr-card ctr-add">
    <div className="ctr-plus">＋</div>
    <div className="ctr-add-text">New counter</div>
    <div className="ctr-add-sub">Select services (required)</div>
    <MultiSelectDropdown
      options={services}
      selected={selected}
      setSelected={setSelected}
    />
    <button
      className="ctr-add-btn"
      onClick={onAdd}
      disabled={loading || selected.length === 0}
      title={selected.length === 0 ? "Please select at least one service" : ""}
    >
      {loading ? "Creating…" : "Add counter"}
    </button>
  </div>
);

const Counters = () => {
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editSelected, setEditSelected] = useState([]);

  const fetchCounters = async () => {
    try {
      setLoadingList(true);
      // Fetch from counters collection to display assigned services and support delete by _id
  const res = await API.get("/counters");
      setCounters(res.data.counters || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load counters");
    } finally {
      setLoadingList(false);
    }
  };

  const fetchServices = async () => {
    try {
  const res = await API.get("/services");
      setServices(res.data.services || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCounters();
    fetchServices();
  }, []);

  const handleAdd = async () => {
    try {
      setError("");
      setLoading(true);
      if (!selectedServices || selectedServices.length === 0) {
        setError("Please select at least one service");
        setLoading(false);
        return;
      }
      // 1) Create the counter user (username/password auto)
      const createUserRes = await API.post("/auth/counters");
      const user = createUserRes?.data?.user;
      // 2) Add counter entry in counters collection with selected services
      await API.post("/counters", {
        counterid: user?.username,
        countername: user?.username,
        counterservices: selectedServices,
      });
      setSelectedServices([]);
      await fetchCounters();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to create counter";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    try {
      setError("");
      const confirmed = window.confirm(
        `Are you sure you want to delete ${name || "this counter"}?`
      );
      if (!confirmed) return;
  await API.delete(`/counters/${id}`);
      // To also delete login user, we'd add a backend deletion endpoint in auth (future enhancement).
      await fetchCounters();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to delete counter";
      setError(msg);
    }
  };

  const startEdit = (counter) => {
    setEditingId(counter._id);
    setEditSelected(counter.counterservices || []);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      setError("");
      if (!editSelected || editSelected.length === 0) {
        setError("Please select at least one service");
        return;
      }
      await API.put(`/counters/${editingId}`, {
        counterservices: editSelected,
      });
      setEditingId(null);
      setEditSelected([]);
      await fetchCounters();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update services";
      setError(msg);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSelected([]);
  };

  return (
    <div className="ctr-page">
      <div className="ctr-header">
        <div className="ctr-header-left">
          <h2 className="ctr-title-page">Counters</h2>
          <div className="ctr-subtitle">View and add counter users</div>
        </div>
        <div className="ctr-header-right">
          <span className="ctr-pill">Total: {counters.length}</span>
        </div>
      </div>
      {error && <div className="ctr-alert">{error}</div>}

      <div className="ctr-grid">
        {loadingList ? (
          <>
            <div className="ctr-card ctr-skel" />
            <div className="ctr-card ctr-skel" />
            <div className="ctr-card ctr-skel" />
          </>
        ) : (
          <>
            {counters.map((c) => (
              <CounterCard
                key={c._id}
                countername={c.countername || c.counterid}
                counterservices={c.counterservices}
                onDelete={() =>
                  handleDelete(c._id, c.countername || c.counterid)
                }
                onEdit={() => startEdit(c)}
                isEditing={editingId === c._id}
                editSelected={editSelected}
                setEditSelected={setEditSelected}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                servicesOptions={services}
              />
            ))}
            <AddCounterCard
              onAdd={handleAdd}
              loading={loading}
              services={services}
              selected={selectedServices}
              setSelected={setSelectedServices}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Counters;
