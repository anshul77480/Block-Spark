export const bandColor = (band) =>
  ({ high: "text-risk-high", medium: "text-risk-medium", low: "text-risk-low" }[band] ||
  "text-slate-400");

export const bandBg = (band) =>
  ({
    high: "bg-risk-high/15 border-risk-high/40 text-risk-high",
    medium: "bg-risk-medium/15 border-risk-medium/40 text-risk-medium",
    low: "bg-risk-low/15 border-risk-low/40 text-risk-low",
  }[band] || "bg-slate-700/20 border-slate-600 text-slate-400");

export const causeBadge = (cause) =>
  ({
    "Malicious Insider": "bg-red-500/15 text-red-400 border-red-500/40",
    "Compromised Account": "bg-amber-500/15 text-amber-400 border-amber-500/40",
    "Negligent User": "bg-sky-500/15 text-sky-400 border-sky-500/40",
  }[cause] || "bg-slate-700/20 text-slate-400 border-slate-600");

export const shortHash = (h) =>
  !h ? "—" : h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;

export const fmtTime = (ts) => {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
};
