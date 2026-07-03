"use client";

import { relativeTime } from "@/lib/format";
import { EmptyState } from "./ui";
import { Bell } from "./icons";

const stripe = (band) =>
  ({ high: "bg-risk-high", medium: "bg-risk-medium", low: "bg-risk-low" }[band] || "bg-faint");
const causeTone = (cause) =>
  ({
    "Malicious Insider": "text-risk-high",
    "Compromised Account": "text-risk-medium",
    "Negligent User": "text-brand",
  }[cause] || "text-muted");

export default function AlertsPanel({ alerts = [], onAck, onSelectEvent }) {
  if (!alerts.length) {
    return <EmptyState icon={Bell} title="No open alerts" hint="Medium+ risk events raise alerts here." />;
  }
  return (
    <div className="scroll-slim -mr-1 max-h-[340px] space-y-2 overflow-y-auto pr-1">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="relative overflow-hidden rounded-xl border border-border-soft bg-base/40 p-3 pl-4"
        >
          <span className={`absolute left-0 top-0 h-full w-1 ${stripe(a.band)}`} />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-ink">{a.username}</span>
                {a.cause && (
                  <span className={`text-[11px] font-medium ${causeTone(a.cause)}`}>{a.cause}</span>
                )}
                <span className="text-[10px] text-faint">· {relativeTime(a.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{a.message}</p>
            </div>
            <span className={`shrink-0 text-lg font-bold tabular-nums ${causeTone(a.cause)}`}>
              {Math.round(a.risk_score)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => onSelectEvent(a.event_id)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition hover:border-brand/40 hover:text-ink"
            >
              Inspect
            </button>
            <button
              onClick={() => onAck(a.id)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition hover:bg-white/5 hover:text-ink"
            >
              Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
