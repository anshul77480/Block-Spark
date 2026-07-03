"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Shield, Activity, Lock, Link as LinkIcon } from "@/components/icons";

const FEATURES = [
  { icon: Activity, text: "Real-time hybrid risk scoring (rules + Isolation Forest)" },
  { icon: Shield, text: "Cause attribution & plain-English explanations" },
  { icon: LinkIcon, text: "Every event hash anchored to an immutable ledger" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* left: brand / marketing panel */}
      <div className="relative hidden overflow-hidden border-r border-border-soft lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand shadow-glow">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <div className="text-lg font-semibold tracking-tight">BlockSpark</div>
            <div className="text-xs text-faint">Insider Threat Detection &amp; Response</div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
            See the threat before the breach.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A banking-grade SOC console that scores every action, explains why it&apos;s
            risky, and contains high-risk sessions — with a tamper-evident audit trail.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-muted">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-brand">
                  <f.icon className="h-4 w-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-faint">Proof of concept · demo environment</p>
      </div>

      {/* right: login form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
              <Shield className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">BlockSpark</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Access the detection &amp; response console.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
                <Lock className="h-4 w-4" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {loading ? "Signing in…" : "Sign in securely"}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-border-soft bg-surface/60 px-3.5 py-2.5 text-center text-xs text-faint">
            Demo credentials · <span className="font-mono text-muted">admin / admin123</span>
          </div>
        </div>
      </div>
    </main>
  );
}
