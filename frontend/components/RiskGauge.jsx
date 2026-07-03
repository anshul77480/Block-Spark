"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

const colorFor = (score) => (score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#22c55e");

export default function RiskGauge({ score = 0, band = "low" }) {
  const value = Math.round(score);
  const data = [{ name: "risk", value }];
  const color = colorFor(value);

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "#1e2739" }} dataKey="value" cornerRadius={12} fill={color} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold" style={{ color }}>
          {value}
        </div>
        <div className="text-xs uppercase tracking-widest text-slate-400">{band} risk</div>
      </div>
    </div>
  );
}
