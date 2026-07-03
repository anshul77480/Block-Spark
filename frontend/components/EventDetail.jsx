"use client";

import RiskGauge from "./RiskGauge";
import { bandBg, causeBadge, shortHash } from "@/lib/format";

function Bar({ value, max }) {
  const pct = Math.min(100, Math.abs(value) / (max || 1) * 100);
  const neg = value < 0;
  return (
    <div className="h-2 w-full rounded bg-soc-bg">
      <div
        className={`h-2 rounded ${neg ? "bg-sky-500" : "bg-risk-high"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function EventDetail({ event }) {
  if (!event) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Select an event to see its cause, explanation and audit anchor.
      </p>
    );
  }

  const maxContrib = Math.max(
    1e-6,
    ...(event.top_features || []).map((f) => Math.abs(f.contribution || 0))
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RiskGauge score={event.risk_score} band={event.band} />
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">User</span>
            <span className="font-medium text-slate-100">
              {event.username} <span className="text-slate-500">({event.role})</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Action</span>
            <span className="font-mono text-slate-200">{event.action_type}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Resource</span>
            <span className="truncate font-mono text-xs text-slate-300">{event.resource}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cause</span>
            {event.cause ? (
              <span className={`rounded border px-2 py-0.5 text-xs ${causeBadge(event.cause)}`}>
                {event.cause}
              </span>
            ) : (
              <span className="text-xs text-slate-500">n/a (low risk)</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Scores</span>
            <span className="font-mono text-xs text-slate-300">
              rule {event.rule_score} · ml {event.ml_score}
            </span>
          </div>
        </div>
      </div>

      {event.explanation && (
        <div className="rounded-lg border border-soc-border bg-soc-bg/50 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Plain-English explanation
          </div>
          <p className="text-sm leading-relaxed text-slate-200">{event.explanation}</p>
          {event.recommended_action && (
            <p className="mt-2 text-sm text-amber-300">
              <span className="font-semibold">Recommended action:</span>{" "}
              {event.recommended_action}
            </p>
          )}
        </div>
      )}

      {event.rules_fired?.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Rules fired</div>
          <div className="flex flex-wrap gap-2">
            {event.rules_fired.map((r) => (
              <span
                key={r.rule}
                title={r.detail}
                className="rounded border border-risk-high/40 bg-risk-high/10 px-2 py-0.5 text-xs text-risk-high"
              >
                {r.rule} +{r.points}
              </span>
            ))}
          </div>
        </div>
      )}

      {event.top_features?.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Top contributing features (SHAP)
          </div>
          <div className="space-y-2">
            {event.top_features.map((f) => (
              <div key={f.feature} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span className="font-mono text-slate-300">{f.feature}</span>
                  <span className="text-slate-500">
                    val {f.value} · contrib {f.contribution}
                  </span>
                </div>
                <Bar value={f.contribution} max={maxContrib} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-soc-border bg-soc-bg/50 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Blockchain audit anchor
          </span>
          {event.anchored ? (
            <span className="rounded border border-soc-accent/40 bg-soc-accent/10 px-2 py-0.5 text-[10px] text-soc-accent">
              ⛓ ANCHORED
            </span>
          ) : (
            <span className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-500">
              NOT ANCHORED
            </span>
          )}
        </div>
        <div className="space-y-1 font-mono text-[11px] text-slate-400">
          <div>
            <span className="text-slate-500">hash: </span>
            {shortHash(event.event_hash)}
          </div>
          <div>
            <span className="text-slate-500">tx: </span>
            {shortHash(event.anchor_tx)}
          </div>
        </div>
      </div>
    </div>
  );
}
