"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export default function RiskTimeline({ events = [] }) {
  // oldest -> newest for a left-to-right timeline
  const data = [...events]
    .reverse()
    .map((e) => ({ id: e.id, score: e.risk_score, user: e.username, band: e.band }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2739" />
          <XAxis dataKey="id" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#111725",
              border: "1px solid #1e2739",
              borderRadius: 8,
              color: "#e2e8f0",
            }}
            labelFormatter={(id) => `Event #${id}`}
            formatter={(v, _n, p) => [`${v} (${p.payload.band})`, p.payload.user]}
          />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
