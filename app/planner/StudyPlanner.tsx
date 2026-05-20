"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { LOCATIONS, ROOMS } from "../lib/rooms";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { bookingUrl } from "../lib/booking-url";
import { useFavorites } from "../lib/favorites";
import {
  StudyPreferences,
  CandidateBlock,
  ScheduleRecommendation,
  DayAvailability,
  SlotInfo,
  defaultPreferences,
  getUpcomingDates,
  generateSchedule,
} from "../lib/planner";
import type { SlotData } from "../components/TimeGrid";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
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

type Step = "preferences" | "loading" | "results";

const DURATION_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 60, label: "1hr" },
  { value: 90, label: "1.5hr" },
  { value: 120, label: "2hr" },
  { value: 150, label: "2.5hr" },
  { value: 180, label: "3hr" },
  { value: 210, label: "3.5hr" },
  { value: 240, label: "4hr" },
];

export default function StudyPlanner() {
  const { ids: favoriteIds } = useFavorites();
  const [step, setStep] = useState<Step>("preferences");
  const [prefs, setPrefs] = useState<StudyPreferences>(() => ({
    ...defaultPreferences(),
    favoriteRoomIds: favoriteIds,
  }));
  const [result, setResult] = useState<ScheduleRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const updatePref = <K extends keyof StudyPreferences>(key: K, val: StudyPreferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: val }));
  };

  const toggleDay = (day: number) => {
    setPrefs((p) => {
      const existing = p.dayPreferences.find((d) => d.day === day);
      if (existing) {
        return { ...p, dayPreferences: p.dayPreferences.filter((d) => d.day !== day) };
      }
      return { ...p, dayPreferences: [...p.dayPreferences, { day, weight: 1 }] };
    });
  };

  const isDaySelected = (day: number) => prefs.dayPreferences.some((d) => d.day === day);

  const toggleFloor = (floor: string) => {
    setPrefs((p) => {
      const has = p.floorPreferences.includes(floor);
      return { ...p, floorPreferences: has ? p.floorPreferences.filter((f) => f !== floor) : [...p.floorPreferences, floor] };
    });
  };

  const toggleSelectedRoom = (roomId: number) => {
    setPrefs((p) => {
      const has = p.selectedRoomIds.includes(roomId);
      return { ...p, selectedRoomIds: has ? p.selectedRoomIds.filter((id) => id !== roomId) : [...p.selectedRoomIds, roomId] };
    });
  };

  // Rooms visible given current building + capacity filters
  const visibleRooms = useMemo(() => {
    return ROOMS.filter((r) => {
      if (prefs.locationPreference !== "any" && r.locationId !== prefs.locationPreference) return false;
      if (r.capacity < prefs.groupSize) return false;
      return true;
    });
  }, [prefs.locationPreference, prefs.groupSize]);

  const FLOOR_ORDER: Record<string, number> = { "Lower": 0, "Ground": 1, "1st": 2, "2nd": 3, "3rd": 4, "4th": 5 };

  // Floors grouped by building — all floors shown, eligible ones marked
  const floorsByBuilding = useMemo(() => {
    const eligibleFloors = new Set(visibleRooms.map((r) => `${r.locationId}-${r.floor}`));
    const buildings = prefs.locationPreference === "any" ? LOCATIONS : LOCATIONS.filter((l) => l.id === prefs.locationPreference);
    return buildings.map((loc) => {
      const locRooms = ROOMS.filter((r) => r.locationId === loc.id);
      const floors = Array.from(new Set(locRooms.map((r) => r.floor)))
        .sort((a, b) => (FLOOR_ORDER[a] ?? 99) - (FLOOR_ORDER[b] ?? 99));
      return {
        location: loc,
        floors: floors.map((f) => ({ name: f, hasRooms: eligibleFloors.has(`${loc.id}-${f}`) })),
      };
    });
  }, [visibleRooms, prefs.locationPreference]);

  // Rooms filtered by selected floors (for the room picker)
  const floorFilteredRooms = useMemo(() => {
    if (prefs.floorPreferences.length === 0) return visibleRooms;
    return visibleRooms.filter((r) => prefs.floorPreferences.includes(r.floor));
  }, [visibleRooms, prefs.floorPreferences]);

  // Group rooms by building then floor for display
  const roomsByGroup = useMemo(() => {
    const groups: { label: string; rooms: typeof floorFilteredRooms }[] = [];
    const byLoc = new Map<number, typeof floorFilteredRooms>();
    for (const r of floorFilteredRooms) {
      const arr = byLoc.get(r.locationId) || [];
      arr.push(r);
      byLoc.set(r.locationId, arr);
    }
    for (const [locId, rooms] of byLoc) {
      const loc = LOCATIONS.find((l) => l.id === locId);
      // Sub-group by floor
      const byFloor = new Map<string, typeof rooms>();
      for (const r of rooms) {
        const arr = byFloor.get(r.floor) || [];
        arr.push(r);
        byFloor.set(r.floor, arr);
      }
      for (const [floor, floorRooms] of byFloor) {
        groups.push({ label: `${loc?.shortName || "Unknown"} — ${floor} Floor`, rooms: floorRooms });
      }
    }
    return groups;
  }, [floorFilteredRooms]);

  // Build live summary text
  const summaryParts: string[] = [];
  summaryParts.push(`${prefs.sessionsPerWeek}x per week`);
  summaryParts.push(formatDurationLong(prefs.sessionDuration) + " each");
  if (prefs.dayPreferences.length > 0 && prefs.dayPreferences.length < 7) {
    summaryParts.push(prefs.dayPreferences.map((d) => DAY_NAMES[d.day]).join(", "));
  }
  if (prefs.timePreference.type !== "flexible") {
    const labels: Record<string, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings", custom: "custom time" };
    summaryParts.push(labels[prefs.timePreference.type] || "");
  }
  if (prefs.groupSize > 1) summaryParts.push(`${prefs.groupSize}+ seats`);
  if (prefs.locationPreference !== "any") {
    const loc = LOCATIONS.find((l) => l.id === prefs.locationPreference);
    if (loc) summaryParts.push(loc.shortName);
  }
  if (prefs.floorPreferences.length > 0) {
    summaryParts.push(prefs.floorPreferences.join(", ") + " floor");
  }
  if (prefs.roomFilter === "favorites") summaryParts.push("favorites only");
  if (prefs.roomFilter === "custom" && prefs.selectedRoomIds.length > 0) {
    summaryParts.push(`${prefs.selectedRoomIds.length} room${prefs.selectedRoomIds.length > 1 ? "s" : ""} picked`);
  }

  const runPlanner = useCallback(async () => {
    setStep("loading");
    setError(null);
    setResult(null);

    try {
      const today = todayStr();
      const dates = getUpcomingDates(today, 10);

      const targetDates = prefs.dayPreferences.length > 0
        ? dates.filter((d) => {
            const dow = new Date(d + "T12:00:00").getDay();
            return prefs.dayPreferences.some((dp) => dp.day === dow);
          })
        : dates;

      if (targetDates.length === 0) {
        setError("No matching dates in the next 10 days for your selected days.");
        setStep("preferences");
        return;
      }

      setProgress({ current: 0, total: targetDates.length });

      const groupsToFetch: { lid: number; gid: number }[] = [];
      if (prefs.locationPreference === "any") {
        for (const loc of LOCATIONS) {
          for (const group of loc.groups) {
            groupsToFetch.push({ lid: loc.id, gid: group.id });
          }
        }
      } else {
        const loc = LOCATIONS.find((l) => l.id === prefs.locationPreference);
        if (loc) {
          for (const group of loc.groups) {
            groupsToFetch.push({ lid: loc.id, gid: group.id });
          }
        }
      }

      const allDayAvailability: DayAvailability[] = [];

      for (let i = 0; i < targetDates.length; i++) {
        const date = targetDates[i];
        const end = tomorrowStr(date);
        const daySlots: SlotInfo[] = [];

        const fetches = groupsToFetch.map(async ({ lid, gid }) => {
          try {
            const res = await fetch(`/api/availability?start=${date}&end=${end}&lid=${lid}&gid=${gid}`);
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

        if (daySlots.length > 0) {
          allDayAvailability.push({ date, slots: daySlots });
        }

        setProgress({ current: i + 1, total: targetDates.length });
      }

      if (allDayAvailability.length === 0) {
        setError("No availability data found for the selected dates. Bookings may not be open yet.");
        setStep("preferences");
        return;
      }

      const eligibleRooms = ROOMS.filter((r) => {
        if (prefs.locationPreference !== "any" && r.locationId !== prefs.locationPreference) return false;
        return true;
      });

      const schedule = generateSchedule(
        { ...prefs, favoriteRoomIds: favoriteIds },
        allDayAvailability,
        eligibleRooms
      );

      setResult(schedule);
      setStep("results");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("preferences");
    }
  }, [prefs, favoriteIds]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 dark:bg-surface-dark/80 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity cursor-pointer" aria-label="Back to dashboard">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.074 2.356M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.356" />
                  </svg>
                </div>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">Study Planner</h1>
                <p className="text-xs text-muted">Build your weekly booking schedule</p>
              </div>
            </div>
            {step === "results" && (
              <button
                onClick={() => setStep("preferences")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Edit preferences"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Edit
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-booked/30 bg-booked/5 p-4 text-sm text-booked flex items-start gap-3" role="alert">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── PREFERENCES FORM ── */}
        {step === "preferences" && (
          <div className="space-y-4">
            {/* ── Card 1: Sessions & Duration ── */}
            <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-5 space-y-5">
              <legend className="sr-only">Study goals</legend>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">How much do you want to study?</h2>
              </div>

              {/* Sessions per week — segmented buttons */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="sessions-label">Sessions per week</label>
                <div className="flex gap-1.5" role="radiogroup" aria-labelledby="sessions-label">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => updatePref("sessionsPerWeek", n)}
                      role="radio"
                      aria-checked={prefs.sessionsPerWeek === n}
                      className={`flex-1 min-w-[44px] min-h-[44px] rounded-lg text-sm font-bold transition-all cursor-pointer border ${
                        prefs.sessionsPerWeek === n
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration — pill buttons */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="duration-label">Duration each session</label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="duration-label">
                  {DURATION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => updatePref("sessionDuration", value)}
                      role="radio"
                      aria-checked={prefs.sessionDuration === value}
                      className={`px-4 min-h-[44px] rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                        prefs.sessionDuration === value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {prefs.sessionDuration === 240 && (
                  <p className="text-[11px] text-accent">This is the maximum allowed per UCSC Library policy.</p>
                )}
              </div>
            </fieldset>

            {/* ── Card 2: When ── */}
            <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-5 space-y-5">
              <legend className="sr-only">When to study</legend>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">When do you want to study?</h2>
              </div>

              {/* Days — two-row grid on mobile for better touch targets */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="days-label">Preferred days</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5" role="group" aria-labelledby="days-label">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      aria-pressed={isDaySelected(i)}
                      className={`min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        isDaySelected(i)
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  {prefs.dayPreferences.length === 0
                    ? "No days selected — will check all days"
                    : `${prefs.dayPreferences.length} day${prefs.dayPreferences.length > 1 ? "s" : ""} selected`}
                </p>
              </div>

              {/* Time of day */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="time-label">Preferred time</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-labelledby="time-label">
                  {([
                    { type: "morning" as const, label: "Morning", sub: "7 AM – 12 PM", icon: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" },
                    { type: "afternoon" as const, label: "Afternoon", sub: "12 – 5 PM", icon: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" },
                    { type: "evening" as const, label: "Evening", sub: "5 – 10 PM", icon: "M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" },
                    { type: "flexible" as const, label: "Flexible", sub: "Any time", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" },
                  ]).map(({ type, label, sub, icon }) => (
                    <button
                      key={type}
                      onClick={() => updatePref("timePreference", { type })}
                      role="radio"
                      aria-checked={prefs.timePreference.type === type || (prefs.timePreference.type === "custom" && type !== "flexible")}
                      className={`p-3 min-h-[72px] rounded-lg text-left transition-all cursor-pointer border flex flex-col justify-center ${
                        prefs.timePreference.type === type
                          ? "bg-primary/10 border-primary/40 dark:bg-primary/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 shrink-0 ${prefs.timePreference.type === type ? "text-primary" : "text-muted"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                        </svg>
                        <span className={`text-sm font-semibold ${prefs.timePreference.type === type ? "text-primary" : "text-foreground"}`}>
                          {label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted mt-1 pl-6">{sub}</span>
                    </button>
                  ))}
                </div>

                {/* Custom range - inline reveal */}
                {prefs.timePreference.type !== "flexible" && prefs.timePreference.type !== "custom" && (
                  <button
                    onClick={() => updatePref("timePreference", {
                      type: "custom",
                      customStart: prefs.timePreference.type === "morning" ? 7 : prefs.timePreference.type === "afternoon" ? 12 : 17,
                      customEnd: prefs.timePreference.type === "morning" ? 12 : prefs.timePreference.type === "afternoon" ? 17 : 22,
                    })}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer min-h-[32px]"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Set exact hours instead
                  </button>
                )}

                {prefs.timePreference.type === "custom" && (
                  <div className="flex items-end gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="space-y-1.5 flex-1">
                      <label htmlFor="time-from" className="text-xs font-medium text-muted">From</label>
                      <select
                        id="time-from"
                        value={prefs.timePreference.customStart ?? 8}
                        onChange={(e) => updatePref("timePreference", { ...prefs.timePreference, customStart: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
                          <option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-muted pb-2.5">–</span>
                    <div className="space-y-1.5 flex-1">
                      <label htmlFor="time-to" className="text-xs font-medium text-muted">To</label>
                      <select
                        id="time-to"
                        value={prefs.timePreference.customEnd ?? 17}
                        onChange={(e) => updatePref("timePreference", { ...prefs.timePreference, customEnd: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
                          <option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => updatePref("timePreference", { type: "flexible" })}
                      className="p-2 text-muted hover:text-foreground transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label="Clear custom time"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </fieldset>

            {/* ── Card 3: Where ── */}
            <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-5 space-y-5">
              <legend className="sr-only">Room preferences</legend>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">Where do you want to study?</h2>
              </div>

              {/* Building + Group size row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="group-size" className="text-xs font-medium text-muted uppercase tracking-wider">Group size</label>
                  <select
                    id="group-size"
                    value={prefs.groupSize}
                    onChange={(e) => updatePref("groupSize", parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value={1}>Just me</option>
                    <option value={2}>2 people</option>
                    <option value={4}>3–4 people</option>
                    <option value={6}>5–6 people</option>
                    <option value={8}>7–8 people</option>
                    <option value={10}>9–10 people</option>
                    <option value={14}>11–14 people</option>
                    <option value={20}>15+ people</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="building" className="text-xs font-medium text-muted uppercase tracking-wider">Building</label>
                  <select
                    id="building"
                    value={prefs.locationPreference === "any" ? "any" : String(prefs.locationPreference)}
                    onChange={(e) => {
                      const v = e.target.value;
                      updatePref("locationPreference", v === "any" ? "any" : parseInt(v));
                      updatePref("floorPreferences", []);
                      if (prefs.roomFilter === "custom") updatePref("selectedRoomIds", []);
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="any">Either building</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Floor filter — multi-select pills grouped by building */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="floor-label">Floors</label>
                {floorsByBuilding.map(({ location, floors }) => (
                  <div key={location.id} className="space-y-1.5">
                    {floorsByBuilding.length > 1 && (
                      <p className="text-[11px] font-medium text-muted">{location.shortName}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${location.shortName} floors`}>
                      {floors.map(({ name, hasRooms }) => {
                        const isSelected = prefs.floorPreferences.includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => hasRooms && toggleFloor(name)}
                            aria-pressed={isSelected}
                            disabled={!hasRooms}
                            className={`px-3 min-h-[36px] rounded-lg text-xs font-semibold transition-all border ${
                              !hasRooms
                                ? "border-slate-200 dark:border-slate-700 text-muted/30 cursor-not-allowed line-through"
                                : isSelected
                                  ? "bg-primary text-white border-primary shadow-sm cursor-pointer"
                                  : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted">
                  {prefs.floorPreferences.length === 0 ? "Any floor" : `${prefs.floorPreferences.length} floor${prefs.floorPreferences.length > 1 ? "s" : ""} selected`}
                </p>
              </div>

              {/* Room filter mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted uppercase tracking-wider" id="room-filter-label">Which rooms?</label>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby="room-filter-label">
                  {([
                    { value: "all" as const, label: "All rooms", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
                    { value: "favorites" as const, label: "Favorites", icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" },
                    { value: "custom" as const, label: "Pick rooms", icon: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
                  ]).map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        updatePref("roomFilter", value);
                        if (value !== "custom") updatePref("selectedRoomIds", []);
                      }}
                      role="radio"
                      aria-checked={prefs.roomFilter === value}
                      disabled={value === "favorites" && favoriteIds.length === 0}
                      className={`flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        prefs.roomFilter === value
                          ? "bg-primary/10 border-primary/40 text-primary dark:bg-primary/20 shadow-sm"
                          : value === "favorites" && favoriteIds.length === 0
                            ? "border-slate-200 dark:border-slate-700 text-muted/40 cursor-not-allowed"
                            : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill={value === "favorites" && prefs.roomFilter === "favorites" ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                      {label}
                    </button>
                  ))}
                </div>
                {prefs.roomFilter === "favorites" && favoriteIds.length > 0 && (
                  <p className="text-[11px] text-muted">
                    Only your {favoriteIds.length} favorite{favoriteIds.length > 1 ? " rooms" : " room"} will be considered.
                  </p>
                )}
                {prefs.roomFilter === "all" && favoriteIds.length > 0 && (
                  <p className="text-[11px] text-muted">
                    All eligible rooms — {favoriteIds.length} favorite{favoriteIds.length > 1 ? "s" : ""} will be scored higher.
                  </p>
                )}
              </div>

              {/* Room picker — shown when "custom" mode */}
              {prefs.roomFilter === "custom" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted">
                      {prefs.selectedRoomIds.length === 0
                        ? "No rooms selected — all eligible rooms will be used"
                        : `${prefs.selectedRoomIds.length} room${prefs.selectedRoomIds.length > 1 ? "s" : ""} selected`}
                    </p>
                    {prefs.selectedRoomIds.length > 0 && (
                      <button
                        onClick={() => updatePref("selectedRoomIds", [])}
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                    {roomsByGroup.map(({ label, rooms }) => (
                      <div key={label}>
                        <div className="sticky top-0 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm">
                          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</span>
                        </div>
                        {rooms.map((room) => (
                          <label
                            key={room.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={prefs.selectedRoomIds.includes(room.id)}
                              onChange={() => toggleSelectedRoom(room.id)}
                              className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-foreground truncate block">{room.name}</span>
                            </div>
                            <span className="text-[10px] text-muted shrink-0">{room.capacity} seats</span>
                            {favoriteIds.includes(room.id) && (
                              <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor" strokeWidth={0}>
                                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            )}
                          </label>
                        ))}
                      </div>
                    ))}
                    {roomsByGroup.length === 0 && (
                      <div className="px-3 py-6 text-center text-xs text-muted">
                        No rooms match your current filters.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            {/* ── Card 4: Style ── */}
            <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-5 space-y-4">
              <legend className="sr-only">Scheduling style</legend>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">How should sessions be scheduled?</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Scheduling style">
                {([
                  { value: "spread" as const, label: "Spread out", desc: "Rest days between sessions", icon: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" },
                  { value: "packed" as const, label: "Back-to-back", desc: "Sessions on consecutive days", icon: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" },
                  { value: "flexible" as const, label: "Best fit", desc: "Highest-scoring slots win", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" },
                ]).map(({ value, label, desc, icon }) => (
                  <button
                    key={value}
                    onClick={() => updatePref("schedulingStyle", value)}
                    role="radio"
                    aria-checked={prefs.schedulingStyle === value}
                    className={`p-3 min-h-[72px] rounded-lg text-left transition-all cursor-pointer border flex flex-col justify-center ${
                      prefs.schedulingStyle === value
                        ? "bg-primary/10 border-primary/40 dark:bg-primary/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 shrink-0 ${prefs.schedulingStyle === value ? "text-primary" : "text-muted"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                      <span className={`text-sm font-semibold ${prefs.schedulingStyle === value ? "text-primary" : "text-foreground"}`}>
                        {label}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted mt-1 pl-6">{desc}</span>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={prefs.preferSameRoom}
                  onChange={(e) => updatePref("preferSameRoom", e.target.checked)}
                  className="w-4.5 h-4.5 rounded accent-primary cursor-pointer"
                />
                <span className="text-sm text-foreground">Prefer same room each session</span>
              </label>
            </fieldset>

            {/* ── Live summary + submit ── */}
            <div className="sticky bottom-0 bg-background pt-3 pb-4 -mx-4 px-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {summaryParts.map((part, i) => (
                  <span key={i} className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-foreground">
                    {part}
                  </span>
                ))}
              </div>
              <button
                onClick={runPlanner}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-light active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Find my schedule
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-10 text-center space-y-4">
            <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-semibold text-foreground">Scanning availability...</p>
              <p className="text-xs text-muted mt-1">
                Checking {progress.total} {progress.total === 1 ? "day" : "days"} across all rooms
              </p>
              {progress.total > 0 && (
                <div className="mt-3 w-48 mx-auto h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === "results" && result && (
          <div className="space-y-4">
            {/* Summary banner */}
            <div className={`rounded-xl border p-4 ${
              result.blocks.length >= prefs.sessionsPerWeek
                ? "border-available/30 bg-available/5"
                : result.blocks.length > 0
                  ? "border-accent/30 bg-accent/5"
                  : "border-booked/30 bg-booked/5"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  result.blocks.length >= prefs.sessionsPerWeek
                    ? "bg-available/15 text-available"
                    : result.blocks.length > 0
                      ? "bg-accent/15 text-accent"
                      : "bg-booked/15 text-booked"
                }`}>
                  {result.blocks.length >= prefs.sessionsPerWeek ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{result.coverageNote}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {summaryParts.slice(0, 3).map((part, i) => (
                      <span key={i} className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-muted">
                        {part}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Result cards */}
            {result.blocks.length > 0 ? (
              <div className="space-y-3">
                {result.blocks.map((block, i) => (
                  <ResultCard key={`${block.date}-${block.room.id}-${block.startTime}`} block={block} index={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-8 text-center space-y-3">
                <svg className="w-10 h-10 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">No matching slots found</p>
                <p className="text-xs text-muted max-w-xs mx-auto">Try different days, times, or a shorter duration.</p>
                <button
                  onClick={() => setStep("preferences")}
                  className="mt-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-light transition-colors cursor-pointer"
                >
                  Adjust preferences
                </button>
              </div>
            )}

            {result.blocks.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep("preferences")}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-muted hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Adjust & re-run
                </button>
                <button
                  onClick={runPlanner}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors cursor-pointer"
                >
                  Re-scan availability
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-4 mt-auto">
        <div className="max-w-2xl mx-auto px-4 text-xs text-muted text-center">
          Recommendations are based on real-time availability. Book quickly — slots fill up fast.
        </div>
      </footer>
    </div>
  );
}

// ── Result Card ──

function ResultCard({ block, index }: { block: CandidateBlock; index: number }) {
  const matchPct = Math.round(block.score);
  const loc = LOCATIONS.find((l) => l.id === block.room.locationId);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{formatDateShort(block.date)}</p>
            <p className="text-xs text-muted">{DAY_NAMES_FULL[new Date(block.date + "T12:00:00").getDay()]}</p>
          </div>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          matchPct >= 70 ? "bg-available/10 text-available" :
          matchPct >= 45 ? "bg-accent/10 text-accent" :
          "bg-slate-100 dark:bg-slate-800 text-muted"
        }`}>
          {matchPct}% match
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <Link
            href={`/room/${block.room.id}?date=${block.date}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            {block.room.name}
          </Link>
          <p className="text-xs text-muted">
            {loc?.shortName} &middot; {block.room.floor} Floor &middot; {block.room.capacity} seats
          </p>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-available/5 border border-available/15">
          <div>
            <span className="text-sm font-semibold text-foreground">
              {formatTime(block.startTime)} – {formatTime(block.endTime)}
            </span>
            <span className="text-xs text-muted ml-2">{formatDuration(block.durationMins)}</span>
          </div>
          <a
            href={bookingUrl(block.room.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 min-h-[36px] rounded-lg bg-available text-white text-xs font-semibold hover:bg-green-600 transition-colors cursor-pointer inline-flex items-center"
          >
            Book
          </a>
        </div>

        <details className="group">
          <summary className="text-[11px] text-muted cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1 min-h-[28px]">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Why this slot?
          </summary>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {([
              { label: "Time", val: block.scoreBreakdown.timeMatch, max: 30 },
              { label: "Day", val: block.scoreBreakdown.dayMatch, max: 20 },
              { label: "Room", val: block.scoreBreakdown.roomPreference, max: 20 },
              { label: "Size", val: block.scoreBreakdown.capacityFit, max: 15 },
              { label: "Fit", val: block.scoreBreakdown.durationFit, max: 15 },
            ] as const).map(({ label, val, max }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] text-muted mb-1">{label}</div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      val / max >= 0.7 ? "bg-available" : val / max >= 0.4 ? "bg-accent" : "bg-booked/40"
                    }`}
                    style={{ width: `${(val / max) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted mt-0.5 tabular-nums">{val}/{max}</div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
