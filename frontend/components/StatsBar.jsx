"use client";

import { Activity, Warning, Bell, Lock, Link as LinkIcon, Shield } from "./icons";
import { Skeleton } from "./ui";

function StatCard({ icon: Icon, label, value, tone = "brand", hint }) {
  const toneMap = {
    brand: "text-brand bg-brand/10",
    high: "text-risk-high bg-risk-high/10",
    medium: "text-risk-medium bg-risk-medium/10",
    low: "text-risk-low bg-risk-low/10",
    neutral: "text-muted bg-white/5",
  };
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

export default function StatsBar({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
    );
  }
  const s = stats || {};
  const detected = (s.high || 0) + (s.medium || 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard icon={Activity} label="Events" value={s.total_events ?? 0} tone="brand"
        hint={`${detected} flagged`} />
      <StatCard icon={Warning} label="High risk" value={s.high ?? 0} tone="high" hint="auto-blocked" />
      <StatCard icon={Shield} label="Medium" value={s.medium ?? 0} tone="medium" hint="flagged" />
      <StatCard icon={Bell} label="Open alerts" value={s.open_alerts ?? 0} tone="medium" />
      <StatCard icon={Lock} label="Blocked" value={s.blocked_sessions ?? 0} tone="high"
        hint="sessions" />
      <StatCard icon={LinkIcon} label="Anchored" value={s.anchored ?? 0} tone="brand"
        hint="on-chain" />
    </div>
  );
}
