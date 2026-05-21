"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LOCATIONS, ROOMS } from "../lib/rooms";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { bookingUrl } from "../lib/booking-url";
import { useFavorites } from "../lib/favorites";
import {
  CandidateBlock,
  CramPreferences,
  DayAvailability,
  SlotInfo,
  generateCramOptions,
} from "../lib/planner";
import type { SlotData } from "./TimeGrid";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTime(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
}

function formatDurationLong(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${h} hr ${m} min`;
}

type CramStep = "setup" | "loading" | "results";

const CRAM_DURATION_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
  { value: 240, label: "4 hr" },
];

interface CramSessionProps {
  initialDate?: string;
}

export default function CramSession({ initialDate }: CramSessionProps) {
  const { ids: favoriteIds, isFavorite } = useFavorites();
  const [cramStep, setCramStep] = useState<CramStep>("setup");
  const [cramPrefs, setCramPrefs] = useState<CramPreferences>({
    date: initialDate || todayStr(),
    sessionDuration: 120,
    groupSize: 1,
    locationPreference: "any",
  });
  const [cramResults, setCramResults] = useState<CandidateBlock[]>([]);
  const [cramError, setCramError] = useState<string | null>(null);
  const cramDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDate && cramStep === "setup") {
      setCramPrefs((p) => ({ ...p, date: initialDate }));
    }
  }, [initialDate]);

  const runCramSearch = useCallback(async () => {
    setCramStep("loading");
    setCramError(null);
    setCramResults([]);

    try {
      const today = todayStr();
      const end = tomorrowStr(cramPrefs.date);

      const groupsToFetch: { lid: number; gid: number }[] = [];
      if (cramPrefs.locationPreference === "any") {
        for (const loc of LOCATIONS) {
          for (const group of loc.groups) {
            groupsToFetch.push({ lid: loc.id, gid: group.id });
          }
        }
      } else {
        const loc = LOCATIONS.find((l) => l.id === cramPrefs.locationPreference);
        if (loc) {
          for (const group of loc.groups) {
            groupsToFetch.push({ lid: loc.id, gid: group.id });
          }
        }
      }

      const daySlots: SlotInfo[] = [];

      const fetches = groupsToFetch.map(async ({ lid, gid }) => {
        try {
          const res = await fetch(`/api/availability?start=${cramPrefs.date}&end=${end}&lid=${lid}&gid=${gid}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.slots || []) as SlotData[];
        } catch {
          return [];
        }
      });

      const results = await Promise.all(fetches);
      for (const slots of results) {
        for (const s of slots) {
          daySlots.push({
            start: s.start,
            end: s.end,
            itemId: s.itemId,
            checksum: s.checksum,
            available: isSlotAvailable(s),
            future: isSlotFuture(s, today),
          });
        }
      }

      if (daySlots.length === 0) {
        setCramError("No availability data for this date. Bookings may not be open yet, or the library may be closed.");
        setCramStep("setup");
        return;
      }

      const options = generateCramOptions(
        cramPrefs,
        { date: cramPrefs.date, slots: daySlots },
        ROOMS,
        favoriteIds
      );

      setCramResults(options);
      setCramStep("results");
    } catch {
      setCramError("Something went wrong. Please try again.");
      setCramStep("setup");
    }
  }, [cramPrefs, favoriteIds]);

  const cramDateDisplay = formatDateShort(cramPrefs.date);
  const isCramToday = cramPrefs.date === todayStr();

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/3 overflow-hidden">
      {cramError && (
        <div className="border-b border-booked/20 bg-booked/5 px-5 py-3 text-sm text-booked flex items-center gap-3" role="alert">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {cramError}
        </div>
      )}

      {cramStep === "setup" && (
        <div className="px-5 py-4">
          {/* Title row */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">Quick Book</h2>
              <p className="text-[11px] text-muted">Find a room right now</p>
            </div>
          </div>

          {/* Compact inline form */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">When</label>
              <div className="flex items-center gap-1.5">
                <input
                  ref={cramDateInputRef}
                  type="date"
                  value={cramPrefs.date}
                  min={todayStr()}
                  onChange={(e) => {
                    if (e.target.value >= todayStr()) setCramPrefs((p) => ({ ...p, date: e.target.value }));
                  }}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => cramDateInputRef.current?.showPicker()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark text-sm font-semibold text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {cramDateDisplay}
                  {isCramToday && (
                    <span className="px-1.5 py-0.5 rounded bg-available/10 text-available text-[9px] font-bold uppercase">Today</span>
                  )}
                </button>
                {!isCramToday && (
                  <button
                    onClick={() => setCramPrefs((p) => ({ ...p, date: todayStr() }))}
                    className="px-2 py-2 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Duration</label>
              <div className="flex gap-1">
                {CRAM_DURATION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setCramPrefs((p) => ({ ...p, sessionDuration: value }))}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      cramPrefs.sessionDuration === value
                        ? "bg-accent text-primary border-accent shadow-sm"
                        : "border-border dark:border-border-dark bg-card dark:bg-card-dark text-muted hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group size */}
            <div className="flex flex-col gap-1">
              <label htmlFor="cram-group-size" className="text-[10px] font-semibold text-muted uppercase tracking-wider">Group</label>
              <select
                id="cram-group-size"
                value={cramPrefs.groupSize}
                onChange={(e) => setCramPrefs((p) => ({ ...p, groupSize: parseInt(e.target.value) }))}
                className="pl-4 pr-10 py-2.5 rounded-xl text-xs font-semibold border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat"
              >
                <option value={1}>Just me</option>
                <option value={2}>2 people</option>
                <option value={4}>3–4</option>
                <option value={6}>5–6</option>
                <option value={8}>7–8</option>
                <option value={10}>9–10</option>
                <option value={14}>11–14</option>
                <option value={20}>15+</option>
              </select>
            </div>

            {/* Building */}
            <div className="flex flex-col gap-1">
              <label htmlFor="cram-building" className="text-[10px] font-semibold text-muted uppercase tracking-wider">Building</label>
              <select
                id="cram-building"
                value={cramPrefs.locationPreference === "any" ? "any" : String(cramPrefs.locationPreference)}
                onChange={(e) => {
                  const v = e.target.value;
                  setCramPrefs((p) => ({ ...p, locationPreference: v === "any" ? "any" : parseInt(v) }));
                }}
                className="pl-4 pr-10 py-2.5 rounded-xl text-xs font-semibold border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat"
              >
                <option value="any">Either</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.shortName}</option>
                ))}
              </select>
            </div>

            {/* Search button */}
            <button
              onClick={runCramSearch}
              className="px-5 py-2 rounded-lg bg-accent text-primary font-bold text-sm hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Search
            </button>
          </div>
          {cramPrefs.sessionDuration === 240 && (
            <p className="text-[11px] text-accent mt-2">Maximum allowed per UCSC Library policy.</p>
          )}
        </div>
      )}

      {cramStep === "loading" && (
        <div className="px-5 py-6 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-foreground">Scanning {cramDateDisplay}...</p>
        </div>
      )}

      {cramStep === "results" && (
        <div>
          {/* Summary bar */}
          <div className={`px-5 py-3 flex items-center justify-between border-b ${
            cramResults.length > 0
              ? "border-available/20 bg-available/5"
              : "border-booked/20 bg-booked/5"
          }`}>
            <div className="flex items-center gap-2.5">
              {cramResults.length > 0 ? (
                <div className="w-6 h-6 rounded-md bg-available/15 text-available flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-md bg-booked/15 text-booked flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {cramResults.length > 0
                    ? `${cramResults.length} slot${cramResults.length > 1 ? "s" : ""} found`
                    : "No slots found"}
                </span>
                <span className="text-xs text-muted ml-2">
                  {cramDateDisplay} · {formatDurationLong(cramPrefs.sessionDuration)}
                  {cramPrefs.groupSize > 1 ? ` · ${cramPrefs.groupSize}+ seats` : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={runCramSearch}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                Refresh
              </button>
              <button
                onClick={() => setCramStep("setup")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border dark:border-border-dark text-muted hover:text-foreground hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Results list */}
          {cramResults.length > 0 ? (
            <div className="divide-y divide-border/50 dark:divide-border-dark/50 max-h-[350px] overflow-y-auto">
              {cramResults.map((block) => {
                const loc = LOCATIONS.find((l) => l.id === block.room.locationId);
                const faved = isFavorite(block.room.id);

                return (
                  <div key={`${block.room.id}-${block.startTime}`} className="flex items-center gap-3 px-5 py-3 hover:bg-available/3 transition-colors">
                    <div className="shrink-0 text-center min-w-[68px]">
                      <p className="text-sm font-bold text-foreground tabular-nums">{formatTime(block.startTime)}</p>
                      <p className="text-[10px] text-muted tabular-nums">{formatTime(block.endTime)}</p>
                    </div>
                    <div className="w-px h-8 bg-border dark:bg-border-dark shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/room/${block.room.id}?date=${block.date}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate"
                        >
                          {block.room.name}
                        </Link>
                        {faved && (
                          <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor" strokeWidth={0}>
                            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[11px] text-muted truncate">
                        {loc?.shortName} · {block.room.floor} Floor · {block.room.capacity} seats · {formatDuration(block.durationMins)}
                      </p>
                    </div>
                    <a
                      href={bookingUrl(block.room.id, { start: block.startTime, end: block.endTime, roomName: block.room.name })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-available text-white text-xs font-bold hover:bg-green-600 transition-colors cursor-pointer inline-flex items-center shrink-0"
                    >
                      Book
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-muted">Try a different date, shorter duration, or a different building.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
