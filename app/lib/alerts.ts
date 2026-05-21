"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Types ──

export interface SlotAlert {
  id: string;
  roomId: number;
  roomName: string;
  date: string;          // YYYY-MM-DD
  timeRange?: {          // optional — watch specific window
    start: string;       // HH:MM
    end: string;
  };
  createdAt: number;     // timestamp
  triggered: boolean;    // true once notification fired
  triggeredAt?: number;
}

// ── Storage ──

const STORAGE_KEY = "ucsc-slot-alerts";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readAlerts(): SlotAlert[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAlerts(alerts: SlotAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) || "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

// ── Alert ID generation ──

function alertId(roomId: number, date: string, startTime?: string): string {
  return `${roomId}-${date}${startTime ? `-${startTime}` : ""}`;
}

// ── Notification helpers ──

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canNotify(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

function sendNotification(alert: SlotAlert) {
  if (!canNotify()) return;
  const timeInfo = alert.timeRange
    ? ` (${formatHour(alert.timeRange.start)} – ${formatHour(alert.timeRange.end)})`
    : "";
  new Notification("Room Available!", {
    body: `${alert.roomName}${timeInfo} just opened up for ${formatDateNice(alert.date)}`,
    icon: "/ucscbooking.png",
    tag: alert.id, // prevents duplicate notifications
  });
}

function formatHour(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return m === "00" ? `${display} ${ampm}` : `${display}:${m} ${ampm}`;
}

function formatDateNice(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Check alerts against fresh slot data ──

interface SlotData {
  start: string;    // "YYYY-MM-DD HH:MM"
  end: string;
  itemId: number;
  className?: string;
}

function isSlotAvailable(s: SlotData): boolean {
  return !s.className;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function checkAlerts(slots: SlotData[]): SlotAlert[] {
  const alerts = readAlerts();
  const today = todayStr();
  const triggered: SlotAlert[] = [];

  // Purge expired alerts (date in the past and not triggered today)
  const active = alerts.filter((a) => a.date >= today);

  let changed = active.length !== alerts.length;

  for (const alert of active) {
    if (alert.triggered) continue;

    // Find available slots for this room on this date
    const matching = slots.filter((s) => {
      if (s.itemId !== alert.roomId) return false;
      const slotDate = s.start.split(" ")[0];
      if (slotDate !== alert.date) return false;
      if (!isSlotAvailable(s)) return false;

      // If watching a specific time range, check overlap
      if (alert.timeRange) {
        const slotTime = s.start.split(" ")[1];
        if (slotTime < alert.timeRange.start || slotTime >= alert.timeRange.end) return false;
      }
      return true;
    });

    if (matching.length > 0) {
      alert.triggered = true;
      alert.triggeredAt = Date.now();
      changed = true;
      triggered.push(alert);
      sendNotification(alert);
    }
  }

  if (changed) writeAlerts(active);
  return triggered;
}

// ── Hook ──

export function useAlerts() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const alerts: SlotAlert[] = JSON.parse(raw);

  const addAlert = useCallback(
    (roomId: number, roomName: string, date: string, timeRange?: { start: string; end: string }) => {
      const id = alertId(roomId, date, timeRange?.start);
      const current = readAlerts();
      if (current.some((a) => a.id === id)) return; // already watching
      const alert: SlotAlert = {
        id,
        roomId,
        roomName,
        date,
        timeRange,
        createdAt: Date.now(),
        triggered: false,
      };
      writeAlerts([...current, alert]);
    },
    []
  );

  const removeAlert = useCallback((id: string) => {
    writeAlerts(readAlerts().filter((a) => a.id !== id));
  }, []);

  const clearTriggered = useCallback(() => {
    writeAlerts(readAlerts().filter((a) => !a.triggered));
  }, []);

  const clearAll = useCallback(() => {
    writeAlerts([]);
  }, []);

  const isWatching = useCallback(
    (roomId: number, date: string, startTime?: string) => {
      const id = alertId(roomId, date, startTime);
      return alerts.some((a) => a.id === id && !a.triggered);
    },
    [alerts]
  );

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    clearTriggered,
    clearAll,
    isWatching,
  };
}
