"use client";

/**
 * Availability Trends — learns patterns over time from slot data.
 *
 * On each availability fetch, we store a compact snapshot:
 *   { date, roomId, hour, available }
 *
 * Over many snapshots, we aggregate into a per-room heatmap:
 *   room × dayOfWeek × hour → availability rate (0–1)
 *
 * This lets us surface insights like:
 *   "This room is usually available on Tuesdays at 3 PM"
 */

// ── Types ──

interface Snapshot {
  date: string;         // YYYY-MM-DD
  dow: number;          // 0–6 (Sun–Sat)
  roomId: number;
  hour: number;         // 0–23
  available: boolean;
}

interface HourBucket {
  available: number;
  total: number;
}

export interface RoomTrend {
  roomId: number;
  /** 7 (days) × 24 (hours) grid. null = no data for that cell. */
  heatmap: (number | null)[][];
  /** Best time(s) for this room */
  bestSlots: { dow: number; hour: number; rate: number }[];
  /** Overall availability rate */
  overallRate: number;
  sampleCount: number;
}

// ── Storage ──

const STORAGE_KEY = "ucsc-availability-trends";
const MAX_SNAPSHOTS = 5000; // cap to prevent storage bloat

function readSnapshots(): Snapshot[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSnapshots(snaps: Snapshot[]) {
  // If over limit, trim oldest
  const trimmed = snaps.length > MAX_SNAPSHOTS
    ? snaps.slice(snaps.length - MAX_SNAPSHOTS)
    : snaps;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ── Record snapshots from fresh slot data ──

interface SlotData {
  start: string;    // "YYYY-MM-DD HH:MM"
  end: string;
  itemId: number;
  className?: string;
}

export function recordAvailability(slots: SlotData[]) {
  if (slots.length === 0) return;

  const existing = readSnapshots();

  // Determine the date of this data
  const date = slots[0].start.split(" ")[0];
  const dow = new Date(date + "T12:00:00").getDay();

  // Check if we already have data for this exact date to avoid duplicates
  // We allow re-recording same date (data might have changed), but throttle
  const lastRecordKey = `ucsc-trends-last-${date}`;
  const lastRecord = localStorage.getItem(lastRecordKey);
  const now = Date.now();
  if (lastRecord && now - parseInt(lastRecord) < 300000) return; // throttle to 5 min
  localStorage.setItem(lastRecordKey, String(now));

  const newSnaps: Snapshot[] = [];
  for (const slot of slots) {
    const time = slot.start.split(" ")[1];
    const hour = parseInt(time.split(":")[0]);
    newSnaps.push({
      date,
      dow,
      roomId: slot.itemId,
      hour,
      available: !slot.className,
    });
  }

  writeSnapshots([...existing, ...newSnaps]);
}

// ── Analyze trends for a specific room ──

export function getRoomTrend(roomId: number): RoomTrend | null {
  const snaps = readSnapshots().filter((s) => s.roomId === roomId);
  if (snaps.length < 5) return null; // need minimum data

  // Build heatmap: dow (0–6) × hour (0–23)
  const buckets: HourBucket[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ available: 0, total: 0 }))
  );

  for (const snap of snaps) {
    buckets[snap.dow][snap.hour].total++;
    if (snap.available) buckets[snap.dow][snap.hour].available++;
  }

  const heatmap: (number | null)[][] = buckets.map((day) =>
    day.map((b) => (b.total >= 2 ? b.available / b.total : null))
  );

  // Find best slots (rate > 0.6, sorted by rate desc)
  const bestSlots: { dow: number; hour: number; rate: number }[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const rate = heatmap[dow][hour];
      if (rate !== null && rate >= 0.6) {
        bestSlots.push({ dow, hour, rate });
      }
    }
  }
  bestSlots.sort((a, b) => b.rate - a.rate);

  // Overall rate
  let totalAvail = 0;
  let totalCount = 0;
  for (const snap of snaps) {
    totalCount++;
    if (snap.available) totalAvail++;
  }

  return {
    roomId,
    heatmap,
    bestSlots: bestSlots.slice(0, 5),
    overallRate: totalCount > 0 ? totalAvail / totalCount : 0,
    sampleCount: snaps.length,
  };
}

// ── Get quick trend summary for a room on a specific day ──

export interface QuickTrend {
  /** Rate for this day of week, or null if insufficient data */
  dayRate: number | null;
  /** Best hours on this day (rate > 0.6) */
  bestHours: { hour: number; rate: number }[];
  /** How many data points we have for this room */
  sampleCount: number;
}

export function getQuickTrend(roomId: number, date: string): QuickTrend {
  const snaps = readSnapshots().filter((s) => s.roomId === roomId);
  if (snaps.length < 5) return { dayRate: null, bestHours: [], sampleCount: snaps.length };

  const dow = new Date(date + "T12:00:00").getDay();
  const daySnaps = snaps.filter((s) => s.dow === dow);

  if (daySnaps.length < 2) return { dayRate: null, bestHours: [], sampleCount: snaps.length };

  // Overall rate for this day
  const dayAvail = daySnaps.filter((s) => s.available).length;
  const dayRate = dayAvail / daySnaps.length;

  // Per-hour
  const hourBuckets = new Map<number, { avail: number; total: number }>();
  for (const snap of daySnaps) {
    const b = hourBuckets.get(snap.hour) || { avail: 0, total: 0 };
    b.total++;
    if (snap.available) b.avail++;
    hourBuckets.set(snap.hour, b);
  }

  const bestHours: { hour: number; rate: number }[] = [];
  for (const [hour, b] of hourBuckets) {
    if (b.total >= 2) {
      const rate = b.avail / b.total;
      if (rate >= 0.5) bestHours.push({ hour, rate });
    }
  }
  bestHours.sort((a, b) => b.rate - a.rate);

  return { dayRate, bestHours: bestHours.slice(0, 3), sampleCount: snaps.length };
}

// ── Format helpers ──

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatTrendHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display} ${ampm}`;
}

export function formatDayName(dow: number): string {
  return DAY_NAMES[dow] || "";
}

export function trendLabel(rate: number): string {
  if (rate >= 0.8) return "Usually free";
  if (rate >= 0.6) return "Often free";
  if (rate >= 0.4) return "Mixed";
  if (rate >= 0.2) return "Often busy";
  return "Usually busy";
}
