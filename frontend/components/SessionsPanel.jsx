"use client";

const statusStyle = {
  active: "text-risk-low border-risk-low/40 bg-risk-low/10",
  flagged: "text-risk-medium border-risk-medium/40 bg-risk-medium/10",
  blocked: "text-risk-high border-risk-high/40 bg-risk-high/10",
};

export default function SessionsPanel({ sessions = [], onAction }) {
  const relevant = sessions.filter((s) => !s.session_id.endsWith("-baseline"));
  return (
    <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
      {relevant.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No active sessions yet.</p>
      )}
      {relevant.map((s) => (
        <div
          key={s.session_id}
          className="flex items-center justify-between rounded-lg border border-soc-border bg-soc-bg/40 px-3 py-2"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-200">{s.username}</span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                  statusStyle[s.status] || "text-slate-400 border-slate-600"
                }`}
              >
                {s.status}
              </span>
            </div>
            {s.reason && <p className="truncate text-[11px] text-slate-500">{s.reason}</p>}
          </div>
          {s.status === "blocked" ? (
            <button
              onClick={() => onAction(s.session_id, "unblock")}
              className="shrink-0 rounded border border-risk-low/40 px-2 py-1 text-[11px] text-risk-low hover:bg-risk-low/10"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={() => onAction(s.session_id, "block")}
              className="shrink-0 rounded border border-risk-high/40 px-2 py-1 text-[11px] text-risk-high hover:bg-risk-high/10"
            >
              Block session
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
