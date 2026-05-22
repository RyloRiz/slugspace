"use client";

import { useState } from "react";
import Link from "next/link";
import Collapsible from "./ui/collapsible";
import { useBookingHistory, BookingRecord } from "../lib/booking-history";
import { getRoomById, LOCATIONS } from "../lib/rooms";
import { bookingUrl } from "../lib/booking-url";
import { useStudySessions, findSessionForBooking, formatDurationShort } from "../lib/study-sessions";

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(datetime: string): string {
  const time = datetime.split(" ")[1];
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function nextWeekDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLocationShortName(locationId: number): string {
  return LOCATIONS.find((l) => l.id === locationId)?.shortName || "";
}

export default function BookingHistory() {
  const { history, remove, clearAll } = useBookingHistory();
  const { sessions } = useStudySessions();
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  const today = todayStr();
  const records = history.slice(0, 10);

  return (
    <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-surface/50 dark:hover:bg-surface-dark/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/8 dark:bg-secondary/8 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-primary dark:text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              Recent Bookings
            </p>
            <p className="text-[11px] text-muted">{history.length} booking{history.length !== 1 ? "s" : ""} tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
            className="text-[11px] text-muted hover:text-booked cursor-pointer font-medium"
          >
            Clear
          </button>
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Records */}
      <Collapsible open={expanded}>
        <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
          {records.map((record) => (
            <HistoryRow key={record.id} record={record} today={today} onRemove={remove} studySession={findSessionForBooking(sessions, record.roomId, record.date)} />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function HistoryRow({ record, today, onRemove, studySession }: { record: BookingRecord; today: string; onRemove: (id: string) => void; studySession?: import("../lib/study-sessions").StudySession }) {
  const room = getRoomById(record.roomId);
  const isPast = record.date < today;
  const rebookDate = nextWeekDate(record.date);
  const locationName = getLocationShortName(record.locationId);

  return (
    <div className={`px-4 sm:px-5 py-4 sm:py-3.5 flex items-center gap-3 ${isPast ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link
            href={`/room/${record.roomId}?date=${record.date}`}
            className="text-sm font-semibold text-foreground hover:text-primary dark:hover:text-secondary transition-colors truncate cursor-pointer"
          >
            {record.roomName}
          </Link>
          {locationName && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface dark:bg-surface-dark text-muted font-medium shrink-0">
              {locationName}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted">
          {formatDateShort(record.date)} · {formatTime(record.start)} – {formatTime(record.end)}
          <span className="text-muted/50 ml-1.5">· {timeAgo(record.bookedAt)}</span>
        </p>
        {studySession && (
          <p className="text-[10px] text-available font-medium mt-0.5 flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Studied {formatDurationShort(studySession.duration)}
            {studySession.pomodorosCompleted > 0 && ` · ${studySession.pomodorosCompleted} pomo${studySession.pomodorosCompleted !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Rebook next week */}
        {room && (
          <Link
            href={`/room/${record.roomId}?date=${rebookDate}`}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold text-primary dark:text-secondary bg-primary/5 dark:bg-secondary/5 hover:bg-primary/10 dark:hover:bg-secondary/10 border border-primary/10 dark:border-secondary/10 transition-colors cursor-pointer"
            title={`View room for ${formatDateShort(rebookDate)}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
            </svg>
            Rebook
          </Link>
        )}
        {/* Remove */}
        <button
          onClick={() => onRemove(record.id)}
          className="p-2.5 rounded-lg text-muted/30 hover:text-booked hover:bg-booked/5 transition-colors cursor-pointer"
          title="Remove from history"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
