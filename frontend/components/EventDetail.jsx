"use client";

import { useState, useEffect } from "react";
import RiskGauge from "./RiskGauge";
import { causeBadge, shortHash, featureLabel, fmtTime } from "@/lib/format";
import { Badge, CopyButton, EmptyState, initials } from "./ui";
import { Search, Link as LinkIcon, Warning, Shield } from "./icons";
import { verifyOnChain } from "@/lib/api";

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
  const [verifying, setVerifying] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    setVerifyData(null);
    setVerifyError(null);
    setVerifying(false);
  }, [event?.id]);

  const handleVerify = async () => {
    if (!event?.event_hash) return;
    setVerifying(true);
    setVerifyError(null);
    setVerifyData(null);
    try {
      const data = await verifyOnChain(event.event_hash);
      setVerifyData(data);
    } catch (err) {
      setVerifyError(err?.response?.data?.detail || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

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

      {event.tampered && (
        <div className="rounded-xl border border-risk-high/40 bg-risk-high/10 p-3.5 flex items-start gap-3">
          <Warning className="h-5 w-5 text-risk-high shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-risk-high uppercase tracking-wider flex items-center gap-1">
              <span>⚠️ Local DB Tampering Detected</span>
            </h4>
            <p className="text-xs text-muted leading-relaxed font-semibold">
              The local SQL database record for this log has been modified. The calculated SHA-256 hash of these fields does not match the immutable hash anchored on the blockchain ledger.
            </p>
          </div>
        </div>
      )}

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
      <div className="rounded-xl border border-border-soft bg-base/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            <LinkIcon className="h-3.5 w-3.5" /> Blockchain audit anchor
          </span>
          {event.anchored ? (
            <Badge tone="brand">anchored</Badge>
          ) : (
            <Badge tone="neutral">not anchored</Badge>
          )}
        </div>
        <div className="space-y-1.5 font-mono text-[11px] text-muted border-b border-border-soft/60 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span><span className="text-faint">hash </span>{shortHash(event.event_hash)}</span>
            <CopyButton value={event.event_hash} label="Copy event hash" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span><span className="text-faint">tx&nbsp;&nbsp;&nbsp;</span>{shortHash(event.anchor_tx)}</span>
            <CopyButton value={event.anchor_tx} label="Copy tx hash" />
          </div>
        </div>

        {event.anchored && (
          <div className="space-y-2">
            {!verifyData && !verifyError && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="btn-primary w-full py-1.5 text-xs flex justify-center items-center gap-1 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20"
              >
                {verifying ? "Querying Ledger..." : "Verify Ledger Authenticity"}
              </button>
            )}

            {verifyError && (
              <div className="text-xs text-risk-high bg-risk-high/10 border border-risk-high/20 rounded-lg p-2 flex flex-col gap-1">
                <span>⚠️ {verifyError}</span>
                <button onClick={handleVerify} className="underline text-[10px] self-start">Retry</button>
              </div>
            )}

            {verifyData && (
              <div className="animate-fade-in text-xs bg-brand/5 border border-brand/20 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-brand font-semibold text-[10px] uppercase tracking-wider">
                  <span>✓ Ledger Verified</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono text-muted">
                  <span className="text-faint">Log Index:</span>
                  <span className="text-right text-ink font-semibold">{verifyData.index}</span>
                  <span className="text-faint">Block Num:</span>
                  <span className="text-right text-ink font-semibold">#{verifyData.block_number}</span>
                  <span className="text-faint">Timestamp:</span>
                  <span className="text-right text-ink font-semibold">{new Date(verifyData.timestamp * 1000).toLocaleTimeString()}</span>
                  <span className="text-faint">Recorder:</span>
                  <span className="text-right text-ink truncate font-semibold" title={verifyData.recorder}>{shortHash(verifyData.recorder)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QPC signature */}
      {event.qpc_signature && (
        <div className="rounded-xl border border-border-soft bg-base/40 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-soft">
              <Shield className="h-3.5 w-3.5 text-brand" /> Quantum-Safe Signature (QPC)
            </span>
            {event.qpc_verified ? (
              <Badge tone="brand">verified</Badge>
            ) : (
              <Badge tone="danger">failed verification</Badge>
            )}
          </div>
          <div className="space-y-1.5 font-mono text-[11px] text-muted">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-faint">sig </span>
                {(() => {
                  try {
                    const sig = JSON.parse(event.qpc_signature);
                    if (sig.c !== undefined && sig.z !== undefined) {
                      return `c: ${sig.c}, z[0]: ${sig.z[0]}... [ML-DSA Lattice Sig]`;
                    }
                    return shortHash(sig[0]) + `... [256-bit OTS]`;
                  } catch (e) {
                    return "Invalid signature data";
                  }
                })()}
              </span>
              <CopyButton value={event.qpc_signature} label="Copy full QPC signature" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-faint">pub </span>
                {(() => {
                  try {
                    const pub = JSON.parse(event.qpc_pubkey);
                    if (pub.t !== undefined) {
                      return `t[0]: ${pub.t[0]}... [Lattice Pub Vector]`;
                    }
                    return shortHash(pub.pk_0[0]) + `...`;
                  } catch (e) {
                    return "Invalid public key data";
                  }
                })()}
              </span>
              <CopyButton value={event.qpc_pubkey} label="Copy public key" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
