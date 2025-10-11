import axios from "axios";

// Compute a base URL that works both on desktop and when opening from a phone on the same LAN.
// Prefer REACT_APP_API_BASE if provided; otherwise use current host with port 5000.
const DEFAULT_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;
export const API_BASE = process.env.REACT_APP_API_BASE || DEFAULT_BASE;

export const API = axios.create({ baseURL: API_BASE, timeout: 10000 });

export default API;
