"use client";

import { Play, Stop, Activity } from "./icons";
import { StatusDot } from "./ui";

export default function SimulatorControls({ sim, chain, onStart, onStop, onTrigger }) {
  const running = sim?.running;
  const chainOk = chain?.status === "connected" || chain?.status === "anchored";

  return (
    <div className="card space-y-3.5 px-4 py-3">
      {/* Ingestion Controller Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
            <Activity className="h-5 w-5" />
          </span>
          <div className="leading-tight space-y-1">
            <div className="text-sm font-semibold text-ink">Activity simulator</div>
            <div className="flex items-center gap-1.5 text-xs text-faint">
              {running ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-risk-low/20 bg-risk-low/10 px-2.5 py-0.5 font-semibold text-risk-low animate-pulse">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-low opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-risk-low"></span>
                  </span>
                  LIVE INGESTION ACTIVE ({sim.generated ?? 0} events)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-2.5 py-0.5 text-muted font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                  SYSTEM STANDBY
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onStart} disabled={running} className="btn-primary">
            <Play className="h-4 w-4" /> Start
          </button>
          <button
            onClick={onStop}
            disabled={!running}
            className="btn border border-risk-high/40 text-risk-high hover:bg-risk-high/10"
          >
            <Stop className="h-4 w-4" /> Stop
          </button>
        </div>

        <div className="ml-auto hidden items-center gap-2 text-xs text-faint sm:flex">
          <span>Generates realistic admin activity incl. threat scenarios</span>
        </div>
      </div>

      {/* Manual Threat Injection Row */}
      <div className="border-t border-border/40 pt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[10px] font-bold text-faint uppercase tracking-wider mr-2">Trigger Threat Scenario:</span>
        <button
          onClick={() => onTrigger("compromised")}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-[#101726] border border-border hover:border-brand/40 text-muted hover:text-brand transition"
        >
          ⚡ Impossible Velocity
        </button>
        <button
          onClick={() => onTrigger("exfil")}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-[#101726] border border-border hover:border-brand/40 text-muted hover:text-brand transition"
        >
          📂 PII Exfiltration
        </button>
        <button
          onClick={() => onTrigger("destruction")}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-[#101726] border border-border hover:border-brand/40 text-muted hover:text-brand transition"
        >
          🗑️ Log Destruction
        </button>
        <button
          onClick={() => onTrigger("negligent")}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-[#101726] border border-border hover:border-brand/40 text-muted hover:text-brand transition"
        >
          ⚠️ Policy Violation
        </button>
      </div>
    </div>
  );
}
