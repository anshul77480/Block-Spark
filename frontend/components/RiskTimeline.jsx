"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { EmptyState } from "./ui";
import { Activity } from "./icons";

function TooltipBox({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const c = p.band === "high" ? "#f5566c" : p.band === "medium" ? "#fbbf24" : "#34d399";
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-card">
      <div className="font-medium text-ink">{p.user}</div>
      <div className="text-faint">Event #{p.id}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
        <span style={{ color: c }} className="font-semibold">{p.score}</span>
        <span className="text-faint">· {p.band}</span>
      </div>
    </div>
  );
}

export default function RiskTimeline({ events = [] }) {
  const data = [...events]
    .reverse()
    .map((e) => ({ id: e.id, score: e.risk_score, user: e.username, band: e.band }));

  if (!data.length) {
    return <EmptyState icon={Activity} title="No activity yet" hint="Start the simulator to see the risk timeline." />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4f8cff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2130" vertical={false} />
          <XAxis dataKey="id" tick={{ fill: "#5f6c82", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#232c3d" }} />
          <YAxis domain={[0, 100]} tick={{ fill: "#5f6c82", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipBox />} />
          <ReferenceLine y={70} stroke="#f5566c" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={40} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#4f8cff"
            strokeWidth={2}
            fill="url(#riskArea)"
            dot={{ r: 2, fill: "#4f8cff" }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
