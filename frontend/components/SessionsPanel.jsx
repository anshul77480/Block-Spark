"use client";

import { EmptyState, StatusDot, initials } from "./ui";
import { Users, Lock, Unlock } from "./icons";

const statusTone = { active: "low", flagged: "medium", blocked: "high" };
const statusText = {
  active: "text-risk-low",
  flagged: "text-risk-medium",
  blocked: "text-risk-high",
};

export default function SessionsPanel({ sessions = [], onAction }) {
  const relevant = sessions.filter((s) => !s.session_id.endsWith("-baseline"));
  if (!relevant.length) {
    return <EmptyState icon={Users} title="No active sessions" hint="Sessions appear as activity streams in." />;
  }
  return (
    <div className="scroll-slim -mr-1 max-h-[320px] space-y-2 overflow-y-auto pr-1">
      {relevant.map((s) => (
        <div
          key={s.session_id}
          className="flex items-center gap-3 rounded-xl border border-border-soft bg-base/40 px-3 py-2.5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-semibold text-muted">
            {initials(s.username)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-ink">{s.username}</span>
              <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase ${statusText[s.status] || "text-faint"}`}>
                <StatusDot tone={statusTone[s.status] || "neutral"} pulse={s.status === "blocked"} />
                {s.status}
              </span>
            </div>
            {s.reason && <p className="truncate text-[11px] text-faint">{s.reason}</p>}
          </div>
          {s.status === "blocked" ? (
            <button
              onClick={() => onAction(s.session_id, "unblock")}
              className="btn shrink-0 border border-risk-low/40 px-2.5 py-1.5 text-[11px] text-risk-low hover:bg-risk-low/10"
            >
              <Unlock className="h-3.5 w-3.5" /> Unblock
            </button>
          ) : (
            <button
              onClick={() => onAction(s.session_id, "block")}
              className="btn shrink-0 border border-risk-high/40 px-2.5 py-1.5 text-[11px] text-risk-high hover:bg-risk-high/10"
            >
              <Lock className="h-3.5 w-3.5" /> Block
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
