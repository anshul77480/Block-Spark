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
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
};

export const relativeTime = (ts) => {
  try {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 5) return "just now";
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
};

// human labels for feature keys shown in SHAP bars
export const featureLabel = (f) =>
  ({
    hour_of_day: "Hour of day",
    hour_sin: "Time (cyclical)",
    hour_cos: "Time (cyclical)",
    is_off_hours: "Off-hours",
    is_weekend: "Weekend",
    geo_distance_km: "Geo distance",
    is_new_device: "New device",
    is_new_ip: "New network",
    records_accessed_in_window: "Records accessed",
    distinct_accounts_in_window: "Distinct accounts",
    sequential_access_score: "Sequential scraping",
    export_count_in_window: "Export count",
    export_volume_mb: "Export volume",
    download_count_in_window: "Downloads",
    sensitive_resource_access_count: "Sensitive access",
    risky_command_flag: "Risky command",
    no_ticket_flag: "No ticket",
    failed_action_ratio: "Failed actions",
    actions_per_minute: "Action velocity",
    records_z: "Records vs baseline",
    velocity_z: "Velocity vs baseline",
    export_z: "Export vs baseline",
  }[f] || f);
