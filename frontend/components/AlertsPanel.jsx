"use client";

import { bandBg, causeBadge, fmtTime } from "@/lib/format";

export default function AlertsPanel({ alerts = [], onAck, onSelectEvent }) {
  return (
    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
      {alerts.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No open alerts.</p>
      )}
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg border p-3 ${bandBg(a.band)} bg-opacity-10`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">{a.username}</span>
                {a.cause && (
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${causeBadge(a.cause)}`}>
                    {a.cause}
                  </span>
                )}
                <span className="text-[10px] text-slate-500">{fmtTime(a.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{a.message}</p>
            </div>
            <span className="shrink-0 text-lg font-bold">{Math.round(a.risk_score)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => onSelectEvent(a.event_id)}
              className="rounded border border-soc-border px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5"
            >
              Inspect event
            </button>
            <button
              onClick={() => onAck(a.id)}
              className="rounded border border-soc-border px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5"
            >
              Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
