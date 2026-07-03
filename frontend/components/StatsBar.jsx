function Stat({ label, value, tone = "text-slate-100" }) {
  return (
    <div className="rounded-xl border border-soc-border bg-soc-panel px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function StatsBar({ stats }) {
  const s = stats || {};
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <Stat label="Events" value={s.total_events ?? 0} />
      <Stat label="High risk" value={s.high ?? 0} tone="text-risk-high" />
      <Stat label="Medium" value={s.medium ?? 0} tone="text-risk-medium" />
      <Stat label="Open alerts" value={s.open_alerts ?? 0} tone="text-amber-400" />
      <Stat label="Blocked" value={s.blocked_sessions ?? 0} tone="text-red-400" />
      <Stat label="Anchored" value={s.anchored ?? 0} tone="text-soc-accent" />
    </div>
  );
}
