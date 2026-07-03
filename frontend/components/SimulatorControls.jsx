"use client";

export default function SimulatorControls({ sim, chain, onStart, onStop }) {
  const running = sim?.running;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onStart}
        disabled={running}
        className="rounded-lg bg-risk-low/90 px-4 py-2 text-sm font-semibold text-soc-bg transition hover:bg-risk-low disabled:opacity-40"
      >
        ▶ Start simulator
      </button>
      <button
        onClick={onStop}
        disabled={!running}
        className="rounded-lg bg-risk-high/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-risk-high disabled:opacity-40"
      >
        ⏹ Stop
      </button>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            running ? "animate-pulse bg-risk-low" : "bg-slate-600"
          }`}
        />
        {running ? `Live · ${sim.generated} events generated` : "Stopped"}
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className="text-slate-500">Chain:</span>
        <span
          className={`rounded border px-2 py-0.5 ${
            chain?.status === "connected" || chain?.status === "anchored"
              ? "border-soc-accent/40 bg-soc-accent/10 text-soc-accent"
              : "border-slate-600 text-slate-400"
          }`}
        >
          ⛓ {chain?.status || "…"} · {chain?.total_records ?? 0} records
        </span>
      </div>
    </div>
  );
}
