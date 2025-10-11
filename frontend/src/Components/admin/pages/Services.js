import React, { useEffect, useState } from "react";
import API from "../../../api";
import "./Services.css";

const toTitle = (v) =>
  v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : "";

const Services = () => {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    servicename: "",
    servicepiority: "medium",
  });
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    servicename: "",
    servicepiority: "medium",
  });

  const fetchServices = async () => {
    try {
      setLoadingList(true);
      const res = await API.get("/services");
      setServices(res.data.services || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load services");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!form.servicename.trim()) {
      setError("Service name is required");
      return;
    }
    try {
      setLoading(true);
      await API.post("/services", {
        servicename: form.servicename.trim(),
        servicepiority: form.servicepiority,
      });
      setForm({ servicename: "", servicepiority: "medium" });
      setMessage("Service added successfully");
      fetchServices();
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to add service";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (svc) => {
    setEditingId(svc._id);
    setEditForm({
      servicename: svc.servicename,
      servicepiority: svc.servicepiority,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ servicename: "", servicepiority: "medium" });
  };

  const saveEdit = async (id) => {
    try {
      setError("");
      await API.put(`/services/${id}`, {
        servicename: editForm.servicename,
        servicepiority: editForm.servicepiority,
      });
      setMessage("Service updated");
      setTimeout(() => setMessage(""), 1500);
      cancelEdit();
      fetchServices();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update service";
      setError(msg);
    }
  };

  const deleteService = async (id) => {
    try {
      setError("");
      await API.delete(`/services/${id}`);
      setMessage("Service deleted");
      setTimeout(() => setMessage(""), 1500);
      fetchServices();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to delete service";
      setError(msg);
    }
  };

  return (
    <div className="svc-page">
      <div className="svc-header">
        <h2 className="svc-title">Services</h2>
        <div className="svc-sub">Create and manage bank services</div>
      </div>

      <form onSubmit={handleSubmit} className="svc-form">
        <input
          className="svc-input"
          type="text"
          placeholder="Service name (e.g., Cash Withdraw)"
          value={form.servicename}
          onChange={(e) => setForm({ ...form, servicename: e.target.value })}
        />
        <select
          className="svc-select"
          value={form.servicepiority}
          onChange={(e) => setForm({ ...form, servicepiority: e.target.value })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button className="svc-button" type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Service"}
        </button>
      </form>

      {error && <div className="svc-alert error">{error}</div>}
      {message && <div className="svc-alert success">{message}</div>}

      <div className="svc-table-wrap">
        <table className="svc-table">
          <thead>
            <tr>
              <th>Service ID</th>
              <th>Name</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr>
                <td colSpan={4} className="svc-empty">
                  Loading services...
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={4} className="svc-empty">
                  No services yet.
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s._id}>
                  <td>{s.serviceid}</td>
                  <td>
                    {editingId === s._id ? (
                      <input
                        className="svc-input inline"
                        value={editForm.servicename}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            servicename: e.target.value,
                          })
                        }
                      />
                    ) : (
                      s.servicename
                    )}
                  </td>
                  <td>
                    {editingId === s._id ? (
                      <select
                        className="svc-select inline"
                        value={editForm.servicepiority}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            servicepiority: e.target.value,
                          })
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    ) : (
                      toTitle(s.servicepiority)
                    )}
                  </td>
                  <td className="svc-actions">
                    {editingId === s._id ? (
                      <>
                        <button
                          className="svc-btn save"
                          onClick={() => saveEdit(s._id)}
                        >
                          Save
                        </button>
                        <button className="svc-btn cancel" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="svc-btn edit"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="svc-btn del"
                          onClick={() => deleteService(s._id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Services;
