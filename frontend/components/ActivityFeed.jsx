"use client";

import { relativeTime } from "@/lib/format";
import { EmptyState, StatusDot } from "./ui";
import { Activity, Link as LinkIcon } from "./icons";

const scoreTone = (band) =>
  ({
    high: "border-risk-high/40 bg-risk-high/10 text-risk-high",
    medium: "border-risk-medium/40 bg-risk-medium/10 text-risk-medium",
    low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  }[band] || "border-border bg-white/5 text-muted");

export default function ActivityFeed({ events = [], selectedId, onSelect }) {
  if (!events.length) {
    return (
      <EmptyState icon={Activity} title="No activity yet" hint="Start the simulator to stream events into the feed." />
    );
  }

  return (
    <div className="scroll-slim -mr-1 max-h-[560px] space-y-1 overflow-y-auto pr-1">
      {events.map((e) => {
        const active = selectedId === e.id;
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              active
                ? "border-brand/50 bg-brand/10 shadow-glow"
                : "border-transparent hover:border-border hover:bg-white/[0.03]"
            }`}
          >
            <span
              className={`grid h-9 w-11 shrink-0 place-items-center rounded-lg border text-sm font-bold tabular-nums ${scoreTone(
                e.band
              )}`}
            >
              {Math.round(e.risk_score)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{e.username}</span>
                <span className="truncate rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {e.action_type}
                </span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
                {e.resource || "—"}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-faint">{relativeTime(e.timestamp)}</span>
              {e.anchored ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-brand">
                  <LinkIcon className="h-3 w-3" /> anchored
                </span>
              ) : (
                <StatusDot tone="neutral" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
