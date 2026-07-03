"use client";

import { useState, useEffect } from "react";
import { verifyPayloadOnChain, tamperEventLog } from "@/lib/api";
import { shortHash } from "@/lib/format";
import { Badge, CopyButton } from "./ui";
import { Warning, Shield, Database } from "./icons";

export default function TamperSandbox({ event, onRefresh }) {
  const [payloadStr, setPayloadStr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ── DB Tamper state ──────────────────────────────────────────────────────
  const [tampering, setTampering] = useState(false);
  const [tamperDone, setTamperDone] = useState(false);
  const [tamperError, setTamperError] = useState(null);

  // Initialize payload string when event changes
  useEffect(() => {
    if (event) {
      const payload = {
        action_type: event.action_type,
        band: event.band || "low",
        bytes_transferred: event.bytes_transferred || 0,
        cause: event.cause || null,
        event_id: event.id,
        record_count: event.record_count || 0,
        resource: event.resource || null,
        risk_score: event.risk_score || 0,
        timestamp: event.timestamp,
        username: event.username,
      };
      setPayloadStr(JSON.stringify(payload, null, 2));
      setResult(null);
      setError(null);
      setTamperDone(false);
      setTamperError(null);
    }
  }, [event]);

  // ── Blockchain verify handler ────────────────────────────────────────────
  const handleVerify = async () => {
    setError(null);
    setResult(null);
    setVerifying(true);
    try {
      const parsed = JSON.parse(payloadStr);
      const data = await verifyPayloadOnChain(parsed);
      setResult(data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format. Please ensure the payload is well-formed JSON.");
      } else {
        setError(err?.response?.data?.detail || "Verification failed");
      }
    } finally {
      setVerifying(false);
    }
  };

  // ── DB Tamper handler ────────────────────────────────────────────────────
  const handleCorruptDB = async () => {
    if (!event?.id || !event.anchored) return;
    setTamperError(null);
    setTampering(true);
    try {
      await tamperEventLog(event.id);
      setTamperDone(true);
      // Tell the parent to reload this event so tampered flag shows
      if (onRefresh) onRefresh(event.id);
    } catch (err) {
      setTamperError(err?.response?.data?.detail || "Tamper request failed");
    } finally {
      setTampering(false);
    }
  };

  if (!event) {
    return (
      <div className="text-center py-8 text-faint font-medium">
        Select an event to load the Tamper Sandbox.
      </div>
    );
  }

  const isAnchored = !!event.anchored;
  const isTampered = !!event.tampered;

  return (
    <div className="space-y-5">

      {/* ── Section 1: Live DB Tampering ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-risk-high/10 text-risk-high">
            <Database className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
              Live Database Corruption Test
            </h4>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Directly mutates the SQL database row for event&nbsp;
              <code className="text-brand">#{event.id}</code> — changing{" "}
              <code className="text-risk-high">username</code>,{" "}
              <code className="text-risk-high">record_count</code>,{" "}
              <code className="text-risk-high">geo</code>, and{" "}
              <code className="text-risk-high">bytes_transferred</code> to crafted values.
              The on-chain hash stays immutable. Reload this event to see the mismatch.
            </p>
          </div>
        </div>

        {/* Not anchored warning */}
        {!isAnchored && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400 font-semibold">
            <Warning className="h-4 w-4 shrink-0" />
            This event is not yet anchored on-chain. Corruption detection requires a ledger reference.
          </div>
        )}

        {/* Already tampered banner */}
        {isTampered && (
          <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2.5 text-xs text-risk-high font-semibold animate-pulse">
            <Warning className="h-4 w-4 shrink-0 mt-0.5" />
            <span>⚠️ DB record already corrupted — hash mismatch confirmed against ledger.</span>
          </div>
        )}

        {tamperError && (
          <div className="flex items-center gap-2 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2.5 text-xs text-risk-high font-semibold">
            <Warning className="h-4 w-4 shrink-0" /> {tamperError}
          </div>
        )}

        {tamperDone && !isTampered && (
          <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5 text-xs text-brand font-semibold">
            <Shield className="h-4 w-4 shrink-0" />
            Corruption written to DB. Reload the event feed or select this event again to see the red tamper flag.
          </div>
        )}

        <button
          onClick={handleCorruptDB}
          disabled={tampering || !isAnchored || isTampered}
          className="w-full h-9 rounded-md border border-risk-high/30 bg-risk-high/10 text-risk-high hover:bg-risk-high/20 transition-all font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {tampering ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-risk-high/40 border-t-risk-high" />
          ) : (
            <Warning className="h-3.5 w-3.5" />
          )}
          {tampering
            ? "Corrupting DB Row..."
            : isTampered
            ? "DB Already Corrupted ✓"
            : "Corrupt DB Log Row"}
        </button>
      </div>

      {/* ── Section 2: Manual Payload Verify ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">
            Manual Payload Verifier
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            Edit any field below to simulate a modified payload. Click verify to compare its hash against the blockchain — a mismatch means tampering.
          </p>
        </div>

        {/* JSON Payload Text Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-faint uppercase tracking-wider">
              Log Payload (JSON)
            </span>
            <span className="text-[10px] text-brand font-semibold select-none">
              Edit fields to test
            </span>
          </div>
          <textarea
            value={payloadStr}
            onChange={(e) => setPayloadStr(e.target.value)}
            className="w-full h-52 font-mono text-[11px] p-3 rounded-lg border border-border bg-[#05080e] text-[#a5b4fc] focus:ring-1 focus:ring-brand/35 focus:border-brand/40 focus:outline-none resize-none leading-relaxed"
            spellCheck="false"
          />
        </div>

        {error && (
          <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2.5 text-xs text-risk-high font-semibold">
            <Warning className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="btn bg-brand hover:bg-brand-soft text-[#080b12] w-full h-9 transition-all font-bold text-xs rounded-md flex justify-center items-center gap-1.5"
        >
          {verifying ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#080b12]/40 border-t-[#080b12]" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          {verifying ? "Querying Ledger..." : "Verify Ledger Immutability"}
        </button>

        {/* Verification Result Display */}
        {result && (
          <div className="animate-fade-in">
            {result.verified ? (
              <div className="border border-brand/25 bg-brand/5 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-brand/10 text-brand p-1">
                    <Shield className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-brand uppercase tracking-wider">✔ Integrity Verified</h4>
                    <p className="text-[10px] text-faint font-semibold uppercase">Log Hash Matches Blockchain</p>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed font-medium">
                  The computed SHA-256 hash matches the anchored block transaction exactly. This log has NOT been tampered with.
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] text-muted border-t border-brand/20 pt-2 mt-2">
                  <span className="text-faint">Block Number:</span>
                  <span className="text-right text-ink font-semibold">#{result.block_number}</span>
                  <span className="text-faint">Tx Hash:</span>
                  <span className="text-right text-ink font-semibold flex items-center justify-end gap-1.5">
                    {shortHash(result.transaction_hash)}
                    <CopyButton value={result.transaction_hash} label="Copy Tx Hash" size="xs" />
                  </span>
                  <span className="text-faint">Computed Hash:</span>
                  <span className="text-right text-ink font-semibold flex items-center justify-end gap-1.5">
                    {shortHash(result.event_hash)}
                    <CopyButton value={result.event_hash} label="Copy Hash" size="xs" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="border border-risk-high/30 bg-risk-high/5 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-risk-high/10 text-risk-high p-1">
                    <Warning className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-risk-high uppercase tracking-wider">❌ Tampering Detected</h4>
                    <p className="text-[10px] text-faint font-semibold uppercase">Hash Mismatch</p>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed font-medium">
                  The computed SHA-256 hash does not match any anchored transactions. This log record has been modified!
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] text-muted border-t border-risk-high/20 pt-2 mt-2">
                  <span className="text-faint">Computed Hash:</span>
                  <span className="text-right text-risk-high font-semibold flex items-center justify-end gap-1.5">
                    {shortHash(result.event_hash)}
                    <CopyButton value={result.event_hash} label="Copy Hash" size="xs" />
                  </span>
                  <span className="text-faint">Ledger Verification:</span>
                  <span className="text-right text-risk-high font-semibold uppercase">Not Found (Invalid)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
