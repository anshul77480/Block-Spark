"use client";

import { useEffect, useState } from "react";
import { Shield, Link as LinkIcon, Activity, Logout } from "./icons";
import { StatusDot, initials } from "./ui";

function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-xs tabular-nums text-muted">{now}</span>;
}

export default function TopBar({ username, sim, chain, onLogout }) {
  const chainOk = chain?.status === "connected" || chain?.status === "anchored";
  const simOn = sim?.running;

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-5 py-3">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-brand">
            <Shield className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              BlockSpark
            </div>
            <div className="hidden text-[11px] text-faint sm:block">Insider Threat SOC</div>
          </div>
        </div>

        {/* live status chips */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 md:flex">
            <StatusDot tone={simOn ? "low" : "neutral"} pulse={simOn} />
            <Activity className="h-3.5 w-3.5 text-muted" />
            <span className="text-xs text-muted">
              {simOn ? `Live · ${sim.generated ?? 0} events` : "Simulator idle"}
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 sm:flex">
            <StatusDot tone={chainOk ? "brand" : "high"} />
            <LinkIcon className="h-3.5 w-3.5 text-muted" />
            <span className="text-xs text-muted">
              {chainOk ? `Chain · ${chain?.total_records ?? 0}` : "Chain offline"}
            </span>
          </div>

          <div className="hidden rounded-full border border-border bg-surface px-3 py-1.5 lg:block">
            <Clock />
          </div>

          {/* user */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/20 text-xs font-semibold text-brand-soft">
              {initials(username)}
            </span>
            <span className="hidden text-xs font-medium text-ink sm:block">{username}</span>
            <button
              onClick={onLogout}
              title="Sign out"
              className="grid h-7 w-7 place-items-center rounded-full text-faint transition hover:bg-white/5 hover:text-risk-high"
            >
              <Logout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
