"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

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
    <main className="flex min-h-screen items-center justify-center bg-soc-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-soc-border bg-soc-panel p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🛡️</div>
          <h1 className="text-xl font-semibold text-slate-100">Insider Threat SOC</h1>
          <p className="text-sm text-slate-400">Detection &amp; Response Console</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Username
            </label>
            <input
              className="w-full rounded-lg border border-soc-border bg-soc-bg px-3 py-2 text-slate-100 outline-none focus:border-soc-accent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-soc-border bg-soc-bg px-3 py-2 text-slate-100 outline-none focus:border-soc-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-soc-accent py-2 font-semibold text-soc-bg transition hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Demo admin: <span className="font-mono text-slate-400">admin / admin123</span>
        </p>
      </div>
    </main>
  );
}
