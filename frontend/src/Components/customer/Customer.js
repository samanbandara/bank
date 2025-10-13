import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./customer.css";

const Customer = () => {
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onlyDigits = (v) => v.replace(/[^0-9]/g, "");
  const isValid = (v) => v.length === 9 || v.length === 12;

  // Ensure browser back from Customer page goes to the first page ("/")
  useEffect(() => {
    const onPop = () => {
      navigate("/", { replace: true });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);

  const handleBack = () => {
    navigate("/");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const digits = onlyDigits(idNumber);
    if (!isValid(digits)) {
      setError("ID number must be 9 or 12 digits.");
      return;
    }
    setError("");
    navigate(`/customer/${digits}/services`);
  };

  return (
    <div className="customer-page">
      <div className="customer-card">
        <h1 className="customer-title">Customer</h1>
        <p className="customer-subtitle">Enter your ID number to continue</p>

        <form onSubmit={handleSubmit} className="customer-form" noValidate>
          <label htmlFor="idnumber" className="customer-label">
            ID Number (9 or 12 digits)
          </label>
          <input
            id="idnumber"
            type="tel"
            inputMode="numeric"
            placeholder="e.g. 123456789 or 199012345678"
            maxLength={12}
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={!!error}
            aria-describedby={error ? "idnumber-error" : undefined}
            value={idNumber}
            onChange={(e) => {
              setIdNumber(onlyDigits(e.target.value));
              setError("");
            }}
            className="customer-input"
            autoFocus
          />

          {error && (
            <div id="idnumber-error" className="customer-error">
              {error}
            </div>
          )}

          <div className="customer-actions">
            <button
              type="button"
              className="customer-button secondary"
              onClick={handleBack}
            >
              Back
            </button>
            <button
              type="button"
              className="customer-button secondary"
              onClick={() =>
                navigate(`/customer/${onlyDigits(idNumber)}/tokens`)
              }
              disabled={!isValid(onlyDigits(idNumber))}
              title={
                !isValid(onlyDigits(idNumber))
                  ? "Enter a valid ID first"
                  : undefined
              }
            >
              View tokens
            </button>
            <button
              type="submit"
              className="customer-button"
              disabled={!isValid(onlyDigits(idNumber))}
            >
              Continue ➜
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Customer;
