"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Types ──

export interface BookingRecord {
  id: string;
  roomId: number;
  roomName: string;
  date: string;        // YYYY-MM-DD
  start: string;       // "YYYY-MM-DD HH:MM"
  end: string;
  locationId: number;
  groupId: number;
  bookedAt: number;    // timestamp
}

// ── Storage ──

const STORAGE_KEY = "ucsc-booking-history";
const MAX_RECORDS = 50;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readHistory(): BookingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeHistory(records: BookingRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
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

// ── Record ID ──

function recordId(roomId: number, start: string): string {
  return `${roomId}-${start}`;
}

// ── Public API ──

export function addBookingRecord(
  roomId: number,
  roomName: string,
  date: string,
  start: string,
  end: string,
  locationId: number,
  groupId: number,
) {
  const id = recordId(roomId, start);
  const current = readHistory();
  // Don't duplicate
  if (current.some((r) => r.id === id)) return;
  const record: BookingRecord = {
    id,
    roomId,
    roomName,
    date,
    start,
    end,
    locationId,
    groupId,
    bookedAt: Date.now(),
  };
  writeHistory([record, ...current]);
}

// ── Hook ──

export function useBookingHistory() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const history: BookingRecord[] = JSON.parse(raw);

  const remove = useCallback((id: string) => {
    writeHistory(readHistory().filter((r) => r.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    writeHistory([]);
  }, []);

  return { history, remove, clearAll };
}
