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
import Panel from "@/components/Panel";
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
      // auto-select newest event if nothing selected
      if (selectedRef.current == null && ev.length) {
        selectedRef.current = ev[0].id;
        setSelectedId(ev[0].id);
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Request failed");
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
    await controlSimulator("start", 2.0, 0.4);
    refresh();
  };
  const onStop = async () => {
    await controlSimulator("stop");
    refresh();
  };
  const onAck = async (id) => {
    await acknowledgeAlert(id);
    refresh();
  };
  const onSessionAction = async (session_id, action) => {
    await sessionAction(session_id, action, `${action} by ${username}`);
    refresh();
  };
  const onLogout = () => {
    logout();
    router.replace("/");
  };

  const selectedEvent = events.find((e) => e.id === selectedId) || null;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-4">
      {/* header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Insider Threat SOC</h1>
            <p className="text-xs text-slate-500">Detection &amp; Response Console</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">
            Signed in as <span className="font-medium text-slate-200">{username}</span>
          </span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-soc-border px-3 py-1.5 text-slate-300 hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      </header>

      {err && (
        <div className="mb-3 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          {err}
        </div>
      )}

      <div className="mb-4">
        <Panel title="Controls">
          <SimulatorControls sim={sim} chain={chain} onStart={onStart} onStop={onStop} />
        </Panel>
      </div>

      <div className="mb-4">
        <StatsBar stats={stats} />
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* left: activity feed */}
        <div className="xl:col-span-3">
          <Panel title="Activity feed">
            <ActivityFeed events={events} selectedId={selectedId} onSelect={onSelect} />
          </Panel>
        </div>

        {/* middle: detail + timeline */}
        <div className="space-y-4 xl:col-span-6">
          <Panel title="Event analysis">
            <EventDetail event={selectedEvent} />
          </Panel>
          <Panel title="Risk timeline">
            <RiskTimeline events={events} />
          </Panel>
        </div>

        {/* right: alerts + sessions */}
        <div className="space-y-4 xl:col-span-3">
          <Panel
            title="Alerts"
            right={
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                {alerts.length} open
              </span>
            }
          >
            <AlertsPanel alerts={alerts} onAck={onAck} onSelectEvent={onSelect} />
          </Panel>
          <Panel title="Sessions & response">
            <SessionsPanel sessions={sessions} onAction={onSessionAction} />
          </Panel>
        </div>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-600">
        POC · rule engine + Isolation Forest · SHAP + LLM explanations · SHA-256 anchored to local
        chain
      </footer>
    </main>
  );
}
