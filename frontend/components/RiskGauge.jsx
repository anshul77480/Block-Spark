"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

const colorFor = (score) => (score >= 70 ? "#f5566c" : score >= 40 ? "#fbbf24" : "#34d399");

export default function RiskGauge({ score = 0, band = "low" }) {
  const value = Math.round(score);
  const data = [{ name: "risk", value }];
  const color = colorFor(value);

  return (
    <div className="relative h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="74%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "#151b28" }}
            dataKey="value"
            cornerRadius={14}
            fill="url(#gaugeGrad)"
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[2.6rem] font-bold leading-none tabular-nums" style={{ color }}>
          {value}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
          {band} risk
        </div>
      </div>
    </div>
  );
}
