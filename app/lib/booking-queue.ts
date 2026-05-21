"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Types ──

export interface QueuedSlot {
  id: string;
  roomId: number;
  roomName: string;
  date: string;
  start: string;       // "YYYY-MM-DD HH:MM"
  end: string;
  bookingUrl: string;
  addedAt: number;
}

// ── Storage (session-based, survives refresh but not tab close) ──

const STORAGE_KEY = "ucsc-booking-queue";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readQueue(): QueuedSlot[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSlot[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return sessionStorage.getItem(STORAGE_KEY) || "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

// ── Slot ID ──

function slotId(roomId: number, start: string): string {
  return `${roomId}-${start}`;
}

// ── Hook ──

export function useBookingQueue() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const queue: QueuedSlot[] = JSON.parse(raw);

  const addSlot = useCallback(
    (roomId: number, roomName: string, date: string, start: string, end: string, bookingUrl: string) => {
      const id = slotId(roomId, start);
      const current = readQueue();
      if (current.some((s) => s.id === id)) return;
      const slot: QueuedSlot = { id, roomId, roomName, date, start, end, bookingUrl, addedAt: Date.now() };
      writeQueue([...current, slot]);
    },
    []
  );

  const removeSlot = useCallback((id: string) => {
    writeQueue(readQueue().filter((s) => s.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    writeQueue([]);
  }, []);

  const isQueued = useCallback(
    (roomId: number, start: string) => {
      const id = slotId(roomId, start);
      return queue.some((s) => s.id === id);
    },
    [queue]
  );

  const toggleSlot = useCallback(
    (roomId: number, roomName: string, date: string, start: string, end: string, bookingUrl: string) => {
      const id = slotId(roomId, start);
      const current = readQueue();
      if (current.some((s) => s.id === id)) {
        writeQueue(current.filter((s) => s.id !== id));
      } else {
        const slot: QueuedSlot = { id, roomId, roomName, date, start, end, bookingUrl, addedAt: Date.now() };
        writeQueue([...current, slot]);
      }
    },
    []
  );

  return {
    queue,
    count: queue.length,
    addSlot,
    removeSlot,
    clearQueue,
    isQueued,
    toggleSlot,
  };
}
