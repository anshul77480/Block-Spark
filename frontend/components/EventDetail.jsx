"use client";

import RiskGauge from "./RiskGauge";
import { causeBadge, shortHash, featureLabel, fmtTime } from "@/lib/format";
import { Badge, CopyButton, EmptyState, initials } from "./ui";
import { Search, Link as LinkIcon, Warning } from "./icons";

function Bar({ value, max }) {
  const pct = Math.min(100, (Math.abs(value) / (max || 1)) * 100);
  const neg = value < 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full ${neg ? "bg-brand" : "bg-risk-high"}`}
        style={{ width: `${Math.max(4, pct)}%` }}
      />
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-soft/60 py-1.5 last:border-0">
      <span className="text-xs text-faint">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-ink">{children}</span>
    </div>
  );
}

const causeToneClass = (cause) =>
  ({
    "Malicious Insider": "border-risk-high/40 bg-risk-high/10 text-risk-high",
    "Compromised Account": "border-risk-medium/40 bg-risk-medium/10 text-risk-medium",
    "Negligent User": "border-brand/40 bg-brand/10 text-brand",
  }[cause] || "border-border bg-white/5 text-muted");

export default function EventDetail({ event }) {
  if (!event) {
    return (
      <EmptyState
        icon={Search}
        title="No event selected"
        hint="Pick an event from the feed to see its cause, explanation, SHAP drivers and audit anchor."
      />
    );
  }

  const maxContrib = Math.max(
    1e-6,
    ...(event.top_features || []).map((f) => Math.abs(f.contribution || 0))
  );

  return (
    <div className="space-y-4">
      {/* header: identity + cause */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-sm font-semibold text-brand-soft">
            {initials(event.username)}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{event.username}</div>
            <div className="text-xs text-faint">{event.role} · {fmtTime(event.timestamp)}</div>
          </div>
        </div>
        {event.cause ? (
          <span className={`chip ${causeToneClass(event.cause)}`}>
            <Warning className="h-3.5 w-3.5" /> {event.cause}
          </span>
        ) : (
          <span className="chip border-border bg-white/5 text-faint">no cause · low risk</span>
        )}
      </div>

      {/* gauge + meta */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border-soft bg-base/40 p-2">
          <RiskGauge score={event.risk_score} band={event.band} />
          <div className="flex justify-center gap-4 pb-1 text-[11px] text-faint">
            <span>rule <b className="text-muted">{event.rule_score}</b></span>
            <span>ml <b className="text-muted">{event.ml_score}</b></span>
          </div>
        </div>
        <div className="rounded-xl border border-border-soft bg-base/40 px-3.5 py-2">
          <MetaRow label="Action"><span className="font-mono text-sm">{event.action_type}</span></MetaRow>
          <MetaRow label="Resource"><span className="font-mono text-xs">{event.resource || "—"}</span></MetaRow>
          <MetaRow label="Records">{event.record_count?.toLocaleString?.() ?? event.record_count}</MetaRow>
          <MetaRow label="Location">{event.geo || "—"}</MetaRow>
          <MetaRow label="Device"><span className="font-mono text-xs">{event.device_id || "—"}</span></MetaRow>
          <MetaRow label="Ticket">{event.matched_case_id || <span className="text-risk-medium">none</span>}</MetaRow>
        </div>
      </div>

      {/* explanation */}
      {event.explanation && (
        <div className="rounded-xl border border-border-soft bg-base/40 p-3.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Analyst summary
          </div>
          <p className="text-sm leading-relaxed text-ink/90">{event.explanation}</p>
          {event.recommended_action && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-risk-medium/30 bg-risk-medium/10 px-3 py-2">
              <Warning className="mt-0.5 h-4 w-4 shrink-0 text-risk-medium" />
              <p className="text-sm text-risk-medium">
                <span className="font-semibold">Recommended: </span>
                {event.recommended_action}
              </p>
            </div>
          )}
        </div>
      )}

      {/* rules fired */}
      {event.rules_fired?.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Rules fired
          </div>
          <div className="flex flex-wrap gap-2">
            {event.rules_fired.map((r) => (
              <span
                key={r.rule}
                title={r.detail}
                className="chip cursor-help border-risk-high/35 bg-risk-high/10 text-risk-high"
              >
                {r.rule.replace(/_/g, " ")}
                <span className="rounded bg-risk-high/20 px-1 text-[10px]">+{r.points}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SHAP */}
      {event.top_features?.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Top contributing features · SHAP
          </div>
          <div className="space-y-2.5">
            {event.top_features.map((f) => (
              <div key={f.feature} className="text-xs">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-medium text-muted">{featureLabel(f.feature)}</span>
                  <span className="font-mono text-[10px] text-faint">
                    val {f.value} · {f.contribution >= 0 ? "+" : ""}{f.contribution}
                  </span>
                </div>
                <Bar value={f.contribution} max={maxContrib} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* audit anchor */}
      <div className="rounded-xl border border-border-soft bg-base/40 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            <LinkIcon className="h-3.5 w-3.5" /> Blockchain audit anchor
          </span>
          {event.anchored ? (
            <Badge tone="brand">anchored</Badge>
          ) : (
            <Badge tone="neutral">not anchored</Badge>
          )}
        </div>
        <div className="space-y-1.5 font-mono text-[11px] text-muted">
          <div className="flex items-center justify-between gap-2">
            <span><span className="text-faint">hash </span>{shortHash(event.event_hash)}</span>
            <CopyButton value={event.event_hash} label="Copy event hash" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span><span className="text-faint">tx&nbsp;&nbsp;&nbsp;</span>{shortHash(event.anchor_tx)}</span>
            <CopyButton value={event.anchor_tx} label="Copy tx hash" />
          </div>
        </div>
      </div>
    </div>
  );
}
