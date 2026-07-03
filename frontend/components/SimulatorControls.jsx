"use client";

import { Play, Stop, Activity } from "./icons";
import { StatusDot } from "./ui";

export default function SimulatorControls({ sim, chain, onStart, onStop }) {
  const running = sim?.running;
  const chainOk = chain?.status === "connected" || chain?.status === "anchored";

  return (
    <div className="card flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
          <Activity className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink">Activity simulator</div>
          <div className="flex items-center gap-1.5 text-xs text-faint">
            <StatusDot tone={running ? "low" : "neutral"} pulse={running} />
            {running ? `Live · ${sim.generated ?? 0} events generated` : "Stopped"}
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
  );
}
