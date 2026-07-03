"use client";

import { useEffect, useState } from "react";
import { Check, Warning } from "./icons";

// tiny pub/sub toast store — no context/provider plumbing needed
let listeners = [];
let counter = 0;

export function toast(message, kind = "success") {
  const t = { id: ++counter, message, kind };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-card backdrop-blur ${
            t.kind === "error"
              ? "border-risk-high/40 bg-risk-high/15 text-risk-high"
              : "border-risk-low/40 bg-risk-low/15 text-risk-low"
          }`}
        >
          {t.kind === "error" ? <Warning className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <span className="text-ink/90">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
