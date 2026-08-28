'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Zap,
  RefreshCw,
  Send,
  ArrowLeft,
  Database,
  Bell,
  CheckCircle2,
  XCircle,
  Handshake,
} from 'lucide-react';

interface Booking {
  id: string;
  atlasOrderId: string;
  passengerName: string;
  segments: Array<{ origin: string; destination: string; flightNo: string }>;
}

interface Operation {
  id: string;
  operation: string;
  endpoint: string;
  status: string;
  createdAt: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  sentAt: string;
}

/** Disruption payload handed off to the Flight Board (Step 2 output). */
interface HandoffPayload {
  eventId: string;
  passengerName: string;
  changeType: string;
  reason: string;
  disruptedFlight: {
    flightNo: string;
    airline: string;
    origin: string;
    destination: string;
    scheduledDeparture: string;
  };
  originalItinerary: Array<{
    flightNo: string;
    origin: string;
    destination: string;
    departureAt: string;
  }>;
  simulatedAt: string;
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [scenario, setScenario] = useState('success');
  const [changeType, setChangeType] = useState('CANCELLED');
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [handoff, setHandoff] = useState<HandoffPayload | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/predictions');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const triggerPrediction = async () => {
    if (!selectedBooking) return;
    setLoading('prediction');
    addLog(`Triggering prediction for booking ${selectedBooking}...`);

    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_prediction',
          bookingId: selectedBooking,
        }),
      });
      const data = await res.json();
      addLog(`✓ Prediction complete. Score: ${(data.result.riskScore * 100).toFixed(0)}%`);
      addLog(`  Triggered: ${data.result.triggered}`);
      addLog(`  Packages prepared: ${data.result.packagesPrepared}`);
      await fetchBookings();
    } catch (error) {
      addLog(`✗ Prediction failed: ${error}`);
    } finally {
      setLoading(null);
    }
  };

  const triggerWebhook = async () => {
    if (!selectedBooking) return;
    setLoading('webhook');
    addLog(`Simulating Atlas webhook (${changeType}) for booking ${selectedBooking}...`);

    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_webhook',
          bookingId: selectedBooking,
          changeType,
        }),
      });
      const data = await res.json();
      addLog(`✓ Webhook sent. Event ID: ${data.eventId}`);
      addLog(`  Status: ${data.result.status} - ${data.result.message}`);

      setTimeout(fetchNotifications, 1000);
      await fetchBookings();
    } catch (error) {
      addLog(`✗ Webhook failed: ${error}`);
    } finally {
      setLoading(null);
    }
  };

  const simulateAndHandOff = async () => {
    if (!selectedBooking) return;
    setHandoffLoading(true);
    setHandoff(null);
    addLog(`Simulating disruption (${changeType}) and handing off to Flight Board…`);

    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_disruption',
          bookingId: selectedBooking,
          changeType: changeType === 'CANCELLED' || changeType === 'MATERIAL' ? changeType : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`✗ Disruption simulation failed: ${data.error}`);
        return;
      }
      setHandoff(data.disruption);
      addLog(`✓ Disruption captured: ${data.disruption.eventId}`);
      addLog(`  Payload handed off to Flight Board — generate AI alternatives on /dashboard`);
      await fetchBookings();
    } catch (error) {
      addLog(`✗ Disruption simulation failed: ${error}`);
    } finally {
      setHandoffLoading(false);
    }
  };

  const fetchOperations = async () => {
    if (!selectedBooking) return;
    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_operations',
          bookingId: selectedBooking,
        }),
      });
      const data = await res.json();
      setOperations(data.operations || []);
      addLog(`Fetched ${data.operations?.length || 0} operations`);
    } catch (error) {
      console.error('Failed to fetch operations:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_notifications' }),
      });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F0]">
      {/* Header */}
      <header className="border-b border-[#242424] sticky top-0 z-10 bg-[#000000]/90 backdrop-blur">
        <div className="px-6 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[#F4F4F0]/50 hover:text-lime transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display font-bold text-lg tracking-tight">
              OPS CONSOLE<span className="text-lime">.</span>
            </h1>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase border border-lime/40 text-lime px-2 py-0.5">
              Demo Mode
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/40">
            Pathfinder Control Tower
          </span>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Booking Selector */}
            <div className="ops-panel p-6">
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-lime mb-4 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Target Booking
              </h2>
              <select
                value={selectedBooking}
                onChange={(e) => setSelectedBooking(e.target.value)}
                className="w-full bg-[#000000] border border-[#242424] rounded px-4 py-3 font-mono text-sm text-[#F4F4F0] focus:outline-none focus:border-lime"
              >
                <option value="">Choose a booking…</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.segments[0]?.origin}→{b.segments[0]?.destination} ({b.atlasOrderId})
                  </option>
                ))}
              </select>
            </div>

            {/* Stage 1: Prediction */}
            <div className="ops-panel p-6">
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-yellow-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Gate 01 · Prediction
              </h2>
              <p className="font-mono text-xs text-[#F4F4F0]/50 mb-4 leading-relaxed">
                Calculate risk score and pre-position alternatives silently.
              </p>
              <button
                onClick={triggerPrediction}
                disabled={!selectedBooking || loading === 'prediction'}
                className="w-full py-3 border border-yellow-400/50 text-yellow-400 font-mono text-xs tracking-[0.25em] uppercase hover:bg-yellow-400 hover:text-[#000000] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading === 'prediction' ? (
                  <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Trigger Risk Assessment
              </button>
            </div>

            {/* Stage 2: Webhook */}
            <div className="ops-panel p-6">
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-lime mb-4 flex items-center gap-2">
                <Send className="h-4 w-4" />
                Gate 02 · Confirmation Webhook
              </h2>
              <p className="font-mono text-xs text-[#F4F4F0]/50 mb-4 leading-relaxed">
                Simulate an Atlas schedule-change event.
              </p>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="w-full bg-[#000000] border border-[#242424] rounded px-4 py-2 mb-3 font-mono text-sm text-[#F4F4F0] focus:outline-none focus:border-lime"
              >
                <option value="CANCELLED">CANCELLED</option>
                <option value="MATERIAL">MATERIAL (Significant Change)</option>
                <option value="MINOR">MINOR (Minor Change)</option>
              </select>
              <button
                onClick={triggerWebhook}
                disabled={!selectedBooking || loading === 'webhook'}
                className="w-full py-3 bg-lime text-[#000000] font-mono font-bold text-xs tracking-[0.25em] uppercase hover:bg-[#F4F4F0] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading === 'webhook' ? (
                  <div className="w-4 h-4 rounded-full border-2 border-[#000000] border-t-transparent animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Webhook Event
              </button>
            </div>

            {/* Scenario Selector */}
            <div className="ops-panel p-6">
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-[#F4F4F0]/70 mb-4 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Demo Scenario
              </h2>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-[#000000] border border-[#242424] rounded px-4 py-2 font-mono text-sm text-[#F4F4F0] focus:outline-none focus:border-lime"
              >
                <option value="success">Success (Normal Flow)</option>
                <option value="stale_session">Stale Session</option>
                <option value="price_change">Price Change During Verification</option>
                <option value="no_inventory">No Inventory Available</option>
                <option value="payment_fail">Payment Failure</option>
              </select>
            </div>
          </div>

          {/* Right: Logs & Operations */}
          <div className="space-y-6">
            {/* Activity Log */}
            <div className="ops-panel p-6">
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-[#F4F4F0]/70 mb-4">
                Tower Log
              </h2>
              <div className="bg-[#000000] border border-[#242424] rounded p-4 h-64 overflow-y-auto font-mono text-xs space-y-1.5">
                {logs.length === 0 ? (
                  <p className="text-[#F4F4F0]/30">// Awaiting instructions…</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-[#F4F4F0]/70">
                      <span className="text-lime mr-2">›</span>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Atlas Operations */}
            <div className="ops-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-[#F4F4F0]/70">
                  Atlas Operations
                </h2>
                <button
                  onClick={fetchOperations}
                  disabled={!selectedBooking}
                  className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0] disabled:opacity-40"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {operations.length === 0 ? (
                  <p className="font-mono text-xs text-[#F4F4F0]/30">// No operations recorded.</p>
                ) : (
                  operations.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-3 bg-[#000000] border border-[#242424] rounded px-3 py-2"
                    >
                      {op.status === 'SUCCESS' ? (
                        <CheckCircle2 className="h-4 w-4 text-lime" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="font-mono text-xs text-[#F4F4F0]">{op.operation}</span>
                      <span className="font-mono text-[10px] text-[#F4F4F0]/40">{op.endpoint}</span>
                      <span className="ml-auto font-mono text-[10px] text-[#F4F4F0]/30">
                        {new Date(op.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="ops-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-[#F4F4F0]/70 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-lime" />
                  Transmissions
                </h2>
                <button
                  onClick={fetchNotifications}
                  className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0]"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="font-mono text-xs text-[#F4F4F0]/30">// No transmissions yet.</p>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="bg-[#000000] border border-[#242424] rounded px-3 py-2">
                      <p className="font-display font-semibold text-sm">{notif.title}</p>
                      <p className="font-mono text-xs text-[#F4F4F0]/50">{notif.message}</p>
                      <p className="font-mono text-[10px] text-[#F4F4F0]/30 mt-1">
                        {new Date(notif.sentAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* DISRUPTION HANDOFF (Step 2 only — AI lives on the Flight Board)   */}
        {/* ================================================================= */}
        <div className="ops-panel p-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-mono text-xs tracking-[0.3em] uppercase text-lime flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Gate 03 · Disruption Handoff
              </h2>
              <p className="font-mono text-xs text-[#F4F4F0]/50 mt-2 leading-relaxed">
                Simulate the disruption here. The captured payload (flight, itinerary,
                reason) is handed to the Flight Board, which fetches Atlas routes and
                generates the 3 AI alternatives.
              </p>
            </div>
            <button
              onClick={simulateAndHandOff}
              disabled={!selectedBooking || handoffLoading}
              className="py-3 px-6 bg-lime text-[#000000] font-mono font-bold text-xs tracking-[0.25em] uppercase hover:bg-[#F4F4F0] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shrink-0"
            >
              {handoffLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#000000] border-t-transparent animate-spin" />
              ) : (
                <Handshake className="h-4 w-4" />
              )}
              Simulate &amp; Hand Off
            </button>
          </div>

          {!handoff && !handoffLoading && (
            <p className="font-mono text-xs text-[#F4F4F0]/30">// Select a booking and simulate a disruption to hand it off.</p>
          )}

          {handoffLoading && (
            <p className="font-mono text-xs text-lime animate-pulse">
              // Running prediction engine + firing signed schedule-change webhook…
            </p>
          )}

          {handoff && (
            <div className="space-y-4">
              {/* Captured payload summary */}
              <div className="flex flex-wrap items-center gap-3 bg-[#000000] border border-[#242424] rounded px-4 py-3">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 border border-red-400/40 text-red-400">
                  {handoff.changeType}
                </span>
                <span className="font-mono text-xs text-[#F4F4F0]/70">
                  {handoff.disruptedFlight.flightNo}{' '}
                  {handoff.disruptedFlight.origin}→{handoff.disruptedFlight.destination}
                </span>
                <span className="font-mono text-[10px] text-[#F4F4F0]/40">{handoff.eventId}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#000000] border border-[#242424] rounded p-4">
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/40 mb-2">
                    Captured reason
                  </p>
                  <p className="font-mono text-xs text-[#F4F4F0]/70 leading-relaxed">{handoff.reason}</p>
                </div>
                <div className="bg-[#000000] border border-[#242424] rounded p-4">
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/40 mb-2">
                    Original itinerary
                  </p>
                  {handoff.originalItinerary.map((leg, i) => (
                    <p key={i} className="font-mono text-xs text-[#F4F4F0]/70">
                      <span className="text-lime">{leg.flightNo}</span> {leg.origin}→{leg.destination}{' '}
                      <span className="text-[#F4F4F0]/40">
                        {new Date(leg.departureAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                  ))}
                </div>
              </div>

              {/* Handoff confirmation */}
              <div className="flex flex-wrap items-center gap-3 border border-lime/30 bg-lime/5 rounded px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-lime shrink-0" />
                <p className="font-mono text-xs text-lime">
                  Payload handed off. Open the Flight Board to fetch Atlas routes + generate the 3 AI alternatives.
                </p>
                <Link
                  href="/dashboard"
                  className="ml-auto font-mono text-[10px] tracking-[0.2em] uppercase text-lime border border-lime/40 px-3 py-1.5 hover:bg-lime hover:text-[#000000] transition-colors"
                >
                  Open Flight Board
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
