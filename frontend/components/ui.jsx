"use client";

import { useState } from "react";
import { Copy, Check } from "./icons";

export function Card({ title, subtitle, icon: Icon, right, children, className = "", bodyClass = "p-4" }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
              {subtitle && <p className="truncate text-xs text-faint">{subtitle}</p>}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

const TONES = {
  low: "border-risk-low/20 bg-risk-low/10 text-risk-low shadow-[0_0_8px_rgba(52,211,153,0.08)]",
  medium: "border-risk-medium/20 bg-risk-medium/10 text-risk-medium shadow-[0_0_8px_rgba(251,191,36,0.08)]",
  high: "border-risk-high/20 bg-risk-high/10 text-risk-high shadow-[0_0_8px_rgba(245,86,108,0.08)]",
  brand: "border-brand/20 bg-brand/10 text-brand shadow-[0_0_8px_rgba(79,140,255,0.08)]",
  neutral: "border-border bg-white/5 text-muted",
};

export function Badge({ tone = "neutral", children, className = "" }) {
  return <span className={`chip ${TONES[tone] || TONES.neutral} ${className}`}>{children}</span>;
}

export function StatusDot({ tone = "neutral", pulse = false }) {
  const color = {
    low: "bg-risk-low",
    medium: "bg-risk-medium",
    high: "bg-risk-high",
    brand: "bg-brand",
    neutral: "bg-faint",
  }[tone];
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} ${pulse ? "animate-pulse-ring" : ""}`}
    />
  );
}

export function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard may be unavailable on http */
    }
  };
  return (
    <button
      onClick={onCopy}
      title={label || "Copy"}
      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-faint transition hover:text-ink hover:border-brand/40"
    >
      {copied ? <Check className="h-3 w-3 text-risk-low" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-surface-2 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-faint">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-[220px] text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function initials(name = "") {
  const parts = name.replace(/[_-]/g, " ").split(" ").filter(Boolean);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}
