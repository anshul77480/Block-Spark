"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, BASE_URL } from "@/lib/api";
import { Shield, Activity, Lock, Link as LinkIcon, BlockSparkLogo } from "@/components/icons";

const FEATURES = [
  { 
    icon: Activity, 
    title: "ML Behavior Analytics",
    text: "Isolation Forest anomaly engine trains on user baselines to flag suspicious access hours and query volumes." 
  },
  { 
    icon: Shield, 
    title: "Post-Quantum Cryptography",
    text: "Protects sensitive server configurations and credentials using robust ML-DSA cryptographic signatures." 
  },
  { 
    icon: LinkIcon, 
    title: "Immutable Ledger Anchoring",
    text: "Anchors cryptographic hashes of critical threat logs onto the blockchain for tamper-evident validation." 
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password, mfaRequired ? mfaCode : null);
      if (data.mfa_required) {
        setMfaRequired(true);
        setMfaCode("");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080b12] text-[#e6ebf4] font-sans flex flex-col justify-between">
      {/* Sleek, flat top header */}
      <header className="w-full border-b border-border/60 bg-surface/50">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand border border-brand/20">
              <BlockSparkLogo className="h-6.5 w-6.5" />
            </span>
            <div>
              <div className="text-lg font-bold tracking-tight text-ink flex items-center gap-1.5">
                BlockSpark
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded border border-brand/20 bg-brand/10 text-brand">v2.0</span>
              </div>
              <div className="text-[10px] text-faint font-medium hidden sm:block">Insider Threat Detection &amp; Response</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-muted">
            <a href={`${BASE_URL}/docs`} target="_blank" rel="noreferrer" className="hover:text-brand transition">API Docs</a>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-brand bg-brand/5 border border-brand/10 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Mainnet Local Connected
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Content Area */}
      <div className="mx-auto max-w-[1400px] w-full px-6 my-auto py-12 grid gap-12 lg:grid-cols-12 items-center">
        {/* Left Side: Product Description & Feature List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand/5 border border-brand/25 text-brand">
              <Shield className="h-3.5 w-3.5" />
              FinSpark&apos;26 National Challenge Entry
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink leading-tight">
              Banking-Grade Insider Threat <br />
              Detection &amp; Immutable Audit Logs
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted font-medium">
              Protect critical administrative systems with ML-driven behavior analysis, 
              quantum-safe security (ML-DSA), and high-performance blockchain event anchoring.
            </p>
          </div>

          {/* Features Grid */}
          <div className="space-y-4 max-w-xl pt-4 border-t border-border/40">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 border border-border text-brand">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-ink">{f.title}</h3>
                  <p className="text-xs text-muted leading-relaxed font-medium">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Secure Access Terminal Login Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[400px] border border-border bg-surface p-7 rounded-xl shadow-card">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-ink tracking-tight">Secure Console Sign in</h2>
              <p className="text-xs text-muted font-medium">Verify credentials to open active SOC session.</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {!mfaRequired ? (
                <>
                  <div className="space-y-1.5">
                    <label className="label text-faint">Username</label>
                    <input
                      className="input h-10 px-3 text-sm font-medium"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label text-faint">Password</label>
                    <input
                      type="password"
                      className="input h-10 px-3 text-sm font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3.5">
                  <label className="label text-brand font-bold text-center">2FA verification code (TOTP)</label>
                  <input
                    type="text"
                    placeholder="0 0 0 0 0 0"
                    maxLength={6}
                    className="input text-center text-xl tracking-[0.3em] font-bold font-mono h-11 border-brand bg-brand/5 focus:ring-brand/30"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                  <p className="text-[10px] text-center text-faint font-medium">
                    Enter the 6-digit verification code from Google Authenticator.
                  </p>
                  <button
                    type="button"
                    className="text-xs text-brand hover:underline mx-auto block font-semibold"
                    onClick={() => {
                      setMfaRequired(false);
                      setError("");
                    }}
                  >
                    ← Back to credentials
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-xs text-risk-high font-semibold">
                  <Lock className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn bg-brand hover:bg-brand-soft text-[#080b12] w-full h-10 transition-all font-bold text-sm rounded-lg"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#080b12]/40 border-t-[#080b12]" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {loading ? "Authenticating…" : (mfaRequired ? "Verify & Enter SOC" : "Establish Secure Session")}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 rounded-lg border border-border bg-surface-2/45 px-4 py-2.5 text-center text-xs text-faint font-medium">
              Demo credentials: <span className="font-mono text-muted select-all font-semibold">admin / admin123</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flat Footer */}
      <footer className="w-full py-6 border-t border-border/40 bg-surface/30">
        <div className="mx-auto max-w-[1400px] px-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-faint font-semibold tracking-wider uppercase gap-2">
          <span>© 2026 BlockSpark · All Rights Reserved</span>
          <span>Designed &amp; Developed by Team BlockSpark for FinSpark&apos;26</span>
        </div>
      </footer>
    </main>
  );
}
