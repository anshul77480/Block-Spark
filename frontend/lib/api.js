import axios from "axios";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: BASE_URL });

// attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// on 401, drop the token and bounce to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/")) window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// ---- auth ----
export async function login(username, password, mfa_code = null) {
  const { data } = await api.post("/auth/login", { username, password, mfa_code });
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("username", data.username);
  }
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

// ---- data ----
export const getHealth = () => api.get("/health").then((r) => r.data);
export const getStats = () => api.get("/stats").then((r) => r.data);
export const getEvents = (limit = 50) => api.get(`/events?limit=${limit}`).then((r) => r.data);
export const getEvent = (id) => api.get(`/events/${id}`).then((r) => r.data);
export const getAlerts = (status = "open") =>
  api.get(`/alerts?status=${status}`).then((r) => r.data);
export const acknowledgeAlert = (id) =>
  api.post(`/alerts/${id}/acknowledge`).then((r) => r.data);
export const getSessions = () => api.get("/sessions").then((r) => r.data);
export const getSimStatus = () => api.get("/simulator/status").then((r) => r.data);
export const getChainStatus = () => api.get("/chain/status").then((r) => r.data);

export const controlSimulator = (action, rate_seconds = 2.0, threat_probability = 0.35) =>
  api
    .post("/simulator/control", { action, rate_seconds, threat_probability })
    .then((r) => r.data);

export const triggerScenario = (scenario) =>
  api.post(`/simulator/trigger-scenario/${scenario}`).then((r) => r.data);

export const sessionAction = (session_id, action, reason) =>
  api.post("/sessions/action", { session_id, action, reason }).then((r) => r.data);

export const verifyOnChain = (hash) =>
  api.get(`/chain/verify/${hash}`).then((r) => r.data);

export const verifyPayloadOnChain = (payload) =>
  api.post("/chain/verify-payload", payload).then((r) => r.data);

export const tamperEventLog = (event_id) =>
  api.post(`/events/${event_id}/tamper`).then((r) => r.data);

export const getChainRecords = () =>
  api.get("/chain/records").then((r) => r.data);
