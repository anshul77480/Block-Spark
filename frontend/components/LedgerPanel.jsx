"use client";

import { useEffect, useState } from "react";
import { getChainRecords } from "@/lib/api";
import { EmptyState, Badge, CopyButton } from "./ui";
import { Link as LinkIcon, Search } from "./icons";
import { shortHash } from "@/lib/format";

export default function LedgerPanel() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getChainRecords();
      // Reverse records to show newest first
      setRecords(data.reverse());
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load on-chain ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = records.filter((r) => {
    const term = filterText.toLowerCase();
    return (
      r.event_hash.toLowerCase().includes(term) ||
      r.metadata.toLowerCase().includes(term) ||
      r.recorder.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Smart Contract Audit Logs
        </span>
        <button
          onClick={loadRecords}
          disabled={loading}
          className="text-xs text-brand hover:underline font-medium"
        >
          {loading ? "Refreshing..." : "Refresh Ledger"}
        </button>
      </div>

      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-faint">
          <Search className="h-3.5 w-3.5" />
        </span>
        <input
          type="text"
          placeholder="Filter logs by hash, username, or level..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full rounded-xl border border-border-soft bg-base/20 py-2 pl-9 pr-4 text-xs text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-risk-high/20 bg-risk-high/5 p-4 text-center text-xs text-risk-high">
          {error}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon={LinkIcon}
          title="No ledger logs match search"
          hint="Try clearing your filter or triggering new simulator activities."
        />
      ) : (
        <div className="scroll-slim -mr-1 max-h-[350px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((r) => {
            // metadata format: "username:band:score"
            const parts = r.metadata.split(":");
            const username = parts[0] || "system";
            const band = parts[1] || "unknown";
            const score = parts[2] || "0.0";
            
            const bandTone =
              band === "high" ? "danger" : band === "medium" ? "warning" : "brand";

            return (
              <div
                key={r.index}
                className="rounded-xl border border-border-soft bg-base/20 p-3 space-y-2 font-mono text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Index #{r.index}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted text-[10px]">@{username}</span>
                    <Badge tone={bandTone}>{band} ({score})</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1 text-muted border-t border-border-soft/60 pt-2">
                  <div className="col-span-2 text-faint">Hash:</div>
                  <div className="col-span-10 text-right flex items-center justify-end gap-1 font-semibold text-ink">
                    <span>{shortHash(r.event_hash)}</span>
                    <CopyButton value={r.event_hash} size="xs" label="Copy full hash" />
                  </div>

                  <div className="col-span-2 text-faint">Recorder:</div>
                  <div className="col-span-10 text-right truncate font-semibold" title={r.recorder}>
                    {shortHash(r.recorder)}
                  </div>

                  <div className="col-span-2 text-faint">Time:</div>
                  <div className="col-span-10 text-right font-semibold">
                    {new Date(r.timestamp * 1000).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
