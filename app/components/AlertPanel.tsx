"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAlerts, requestNotificationPermission, canNotify } from "../lib/alerts";
import Collapsible from "./ui/collapsible";

function formatDateNice(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatHour(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return m === "00" ? `${display} ${ampm}` : `${display}:${m} ${ampm}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertPanel() {
  const { alerts, activeAlerts, triggeredAlerts, removeAlert, clearTriggered, clearAll } = useAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const totalCount = alerts.length;
  const triggeredCount = triggeredAlerts.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (totalCount === 0) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
        title={`${activeAlerts.length} active watch${activeAlerts.length !== 1 ? "es" : ""}`}
        aria-label="Slot alerts"
      >
        <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {triggeredCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-available text-white text-[9px] font-bold flex items-center justify-center animate-pulse-soft">
            {triggeredCount}
          </span>
        )}
        {triggeredCount === 0 && activeAlerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-primary text-[9px] font-bold flex items-center justify-center">
            {activeAlerts.length}
          </span>
        )}
      </button>

      <Collapsible open={open} className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50">
        <div className="rounded-2xl bg-card dark:bg-card-dark border border-border dark:border-border-dark shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border dark:border-border-dark flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Slot Watches</h3>
            <div className="flex items-center gap-2">
              {triggeredCount > 0 && (
                <button
                  onClick={clearTriggered}
                  className="text-[11px] text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear opened
                </button>
              )}
              {totalCount > 0 && (
                <button
                  onClick={() => { clearAll(); setOpen(false); }}
                  className="text-[11px] text-booked hover:text-booked/80 transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notification permission hint */}
          {!canNotify() && typeof window !== "undefined" && "Notification" in window && Notification.permission !== "denied" && (
            <button
              onClick={async () => { await requestNotificationPermission(); }}
              className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left bg-accent/5 border-b border-accent/15 hover:bg-accent/10 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-foreground">Enable notifications</p>
                <p className="text-[10px] text-muted">Get alerted even when this tab is in the background</p>
              </div>
            </button>
          )}

          {/* Alert list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/50 dark:divide-border-dark/50">
            {/* Triggered alerts first */}
            {triggeredAlerts.map((alert) => (
              <div key={alert.id} className="px-4 py-3 bg-available/5 flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-available/15 text-available flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/room/${alert.roomId}?date=${alert.date}`}
                    className="text-sm font-semibold text-foreground hover:text-primary dark:hover:text-secondary transition-colors cursor-pointer truncate block"
                    onClick={() => setOpen(false)}
                  >
                    {alert.roomName}
                  </Link>
                  <p className="text-[11px] text-available font-medium">
                    Opened up! &middot; {formatDateNice(alert.date)}
                    {alert.timeRange && ` &middot; ${formatHour(alert.timeRange.start)} – ${formatHour(alert.timeRange.end)}`}
                  </p>
                  {alert.triggeredAt && (
                    <p className="text-[10px] text-muted mt-0.5">{timeAgo(alert.triggeredAt)}</p>
                  )}
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="p-1 text-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
                  aria-label="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Active watches */}
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/room/${alert.roomId}?date=${alert.date}`}
                    className="text-sm font-semibold text-foreground hover:text-primary dark:hover:text-secondary transition-colors cursor-pointer truncate block"
                    onClick={() => setOpen(false)}
                  >
                    {alert.roomName}
                  </Link>
                  <p className="text-[11px] text-muted">
                    Watching &middot; {formatDateNice(alert.date)}
                    {alert.timeRange && ` &middot; ${formatHour(alert.timeRange.start)} – ${formatHour(alert.timeRange.end)}`}
                  </p>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="p-1 text-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
                  aria-label="Stop watching"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {totalCount === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted">No active watches. Tap the eye icon on a booked room to start watching.</p>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
