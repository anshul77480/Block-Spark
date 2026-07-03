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

        <SimulatorControls sim={sim} chain={chain} onStart={onStart} onStop={onStop} />

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
            <Card title="Event analysis" icon={Search}
              subtitle={selectedEvent ? `Event #${selectedEvent.id}` : "Select an event"}>
              <EventDetail event={selectedEvent} />
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

        <footer className="pt-2 pb-6 text-center text-xs text-faint">
          Rule engine + Isolation Forest (22 features) · SHAP + LLM explanations ·
          SHA-256 anchored to local chain · proof of concept
        </footer>
      </main>
    </div>
  );
}
