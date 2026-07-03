"use client";

import { bandBg, fmtTime } from "@/lib/format";

export default function ActivityFeed({ events = [], selectedId, onSelect }) {
  return (
    <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
      {events.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No activity yet — start the simulator.
        </p>
      )}
      {events.map((e) => (
        <button
          key={e.id}
          onClick={() => onSelect(e.id)}
          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
            selectedId === e.id
              ? "border-soc-accent bg-soc-accent/10"
              : "border-transparent hover:border-soc-border hover:bg-white/5"
          }`}
        >
          <span
            className={`inline-flex h-8 w-11 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${bandBg(
              e.band
            )}`}
          >
            {Math.round(e.risk_score)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-200">{e.username}</span>
              <span className="text-xs text-slate-500">{e.action_type}</span>
            </span>
            <span className="block truncate text-xs text-slate-500">{e.resource}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-[10px] text-slate-500">{fmtTime(e.timestamp)}</span>
            {e.anchored ? (
              <span className="text-[10px] text-soc-accent">⛓ anchored</span>
            ) : (
              <span className="text-[10px] text-slate-600">unanchored</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
