"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  acknowledgeAlert,
  controlSimulator,
  getAlerts,
  getChainStatus,
  getEvents,
  getSessions,
  getSimStatus,
  getStats,
  getToken,
  logout,
  sessionAction,
  triggerScenario,
} from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { toast } from "@/components/toast";
import { Activity, Search, Bell, Users, Warning } from "@/components/icons";
import TopBar from "@/components/TopBar";
import StatsBar from "@/components/StatsBar";
import ActivityFeed from "@/components/ActivityFeed";
import AlertsPanel from "@/components/AlertsPanel";
import EventDetail from "@/components/EventDetail";
import SessionsPanel from "@/components/SessionsPanel";
import SimulatorControls from "@/components/SimulatorControls";
import RiskTimeline from "@/components/RiskTimeline";
import LedgerPanel from "@/components/LedgerPanel";
import TamperSandbox from "@/components/TamperSandbox";

const POLL_MS = 2500;

export default function Dashboard() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [sim, setSim] = useState({});
  const [chain, setChain] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [username, setUsername] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const selectedRef = useRef(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    setUsername(localStorage.getItem("username") || "");
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      const [ev, al, se, st, si, ch] = await Promise.all([
        getEvents(60),
        getAlerts("open"),
        getSessions(),
        getStats(),
        getSimStatus(),
        getChainStatus(),
      ]);
      setEvents(ev);
      setAlerts(al);
      setSessions(se);
      setStats(st);
      setSim(si);
      setChain(ch);
      setErr("");
      if (selectedRef.current == null && ev.length) {
        selectedRef.current = ev[0].id;
        setSelectedId(ev[0].id);
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Request failed");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const onSelect = (id) => {
    selectedRef.current = id;
    setSelectedId(id);
  };

  const onStart = async () => {
    try {
      await controlSimulator("start", 2.0, 0.4);
      toast("Simulator started");
      refresh();
    } catch {
      toast("Failed to start simulator", "error");
    }
  };
  const onStop = async () => {
    try {
      await controlSimulator("stop");
      toast("Simulator stopped");
      refresh();
    } catch {
      toast("Failed to stop simulator", "error");
    }
  };
  const onTrigger = async (scenario) => {
    try {
      toast(`Injecting ${scenario} threat scenario...`);
      const event = await triggerScenario(scenario);
      toast(`Scenario ingested! Risk score: ${event.risk_score}%`);
      refresh();
      if (event && event.id) {
        setSelectedId(event.id);
      }
    } catch (e) {
      toast(e?.response?.data?.detail || "Failed to trigger scenario", "error");
    }
  };
  const onAck = async (id) => {
    try {
      await acknowledgeAlert(id);
      toast("Alert acknowledged");
      refresh();
    } catch {
      toast("Failed to acknowledge", "error");
    }
  };
  const onSessionAction = async (session_id, action) => {
    try {
      await sessionAction(session_id, action, `${action} by ${username}`);
      toast(action === "block" ? "Session blocked" : "Session unblocked");
      refresh();
    } catch {
      toast(`Failed to ${action} session`, "error");
    }
  };
  const onLogout = () => {
    logout();
    router.replace("/");
  };

  const selectedEvent = events.find((e) => e.id === selectedId) || null;

  return (
    <div className="min-h-screen">
      <TopBar username={username} sim={sim} chain={chain} onLogout={onLogout} />

      <main className="mx-auto max-w-[1600px] space-y-4 px-5 py-5">
        {err && (
          <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-risk-high/40 bg-risk-high/10 px-3.5 py-2.5 text-sm text-risk-high">
            <Warning className="h-4 w-4" /> {err}
          </div>
        )}

        <SimulatorControls sim={sim} chain={chain} onStart={onStart} onStop={onStop} onTrigger={onTrigger} />

        <StatsBar stats={stats} loading={!loaded} />

        {/* main grid */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* left: activity feed */}
          <div className="xl:col-span-3">
            <Card
              title="Activity feed"
              icon={Activity}
              right={<Badge tone="brand">{events.length}</Badge>}
            >
              {!loaded ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : (
                <ActivityFeed events={events} selectedId={selectedId} onSelect={onSelect} />
              )}
            </Card>
          </div>

          {/* middle: detail + timeline */}
          <div className="space-y-4 xl:col-span-6">
            <Card
              title={
                activeTab === "analysis" ? "Event analysis" : 
                activeTab === "ledger" ? "Blockchain Ledger" : "Tamper Sandbox"
              }
              icon={Search}
              subtitle={
                activeTab === "analysis" ? (selectedEvent ? `Event #${selectedEvent.id}` : "Select an event") :
                activeTab === "ledger" ? "Audit log records fetched directly from contract state" : "Simulate DB log modification & blockchain validation"
              }
              right={
                <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border-soft">
                  <button
                    onClick={() => setActiveTab("analysis")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                      activeTab === "analysis"
                        ? "bg-brand/10 text-brand border border-brand/20"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab("ledger")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                      activeTab === "ledger"
                        ? "bg-brand/10 text-brand border border-brand/20"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Ledger Log
                  </button>
                  <button
                    onClick={() => setActiveTab("tamper")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                      activeTab === "tamper"
                        ? "bg-brand/10 text-brand border border-brand/20"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Tamper Sandbox
                  </button>
                </div>
              }
            >
              {activeTab === "analysis" ? (
                <EventDetail event={selectedEvent} />
              ) : activeTab === "ledger" ? (
                <LedgerPanel />
              ) : (
                <TamperSandbox event={selectedEvent} onRefresh={() => refresh()} />
              )}
            </Card>
            <Card title="Risk timeline" icon={Activity} subtitle="Score per event · thresholds at 40 / 70">
              <RiskTimeline events={events} />
            </Card>
          </div>

          {/* right: alerts + sessions */}
          <div className="space-y-4 xl:col-span-3">
            <Card title="Alerts" icon={Bell}
              right={<Badge tone="medium">{alerts.length} open</Badge>}>
              <AlertsPanel alerts={alerts} onAck={onAck} onSelectEvent={onSelect} />
            </Card>
            <Card title="Sessions & response" icon={Users}>
              <SessionsPanel sessions={sessions} onAction={onSessionAction} />
            </Card>
          </div>
        </div>

        <footer className="pt-6 pb-4 border-t border-border/40 mt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-faint font-semibold tracking-wide uppercase gap-2">
          <span>© 2026 BlockSpark · Developed by Team BlockSpark for FinSpark&apos;26</span>
          <span className="hidden md:inline">ML Behavior Engine · Quantum-Safe Core · Immutable Blockchain Logs</span>
        </footer>
      </main>
    </div>
  );
}
