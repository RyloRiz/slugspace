"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { LOCATIONS, ROOMS } from "../lib/rooms";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { bookingUrl } from "../lib/booking-url";
import BookLink from "../components/BookLink";
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

const LIBRARY_IMAGES: Record<number, string> = {
  16578: "/libraries/se-hero.png",
  16577: "/libraries/mchenry-hero.png",
};

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

type WizardStep = 1 | 2 | 3;
type Phase = "wizard" | "loading" | "results";

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

const STEP_TITLES = ["", "How often?", "When?", "Where?"];
const STEP_SUBTITLES = [
  "",
  "Set the rhythm of your study week",
  "Pick your ideal days and times",
  "Choose your library and fine-tune",
];

// Slide animation variants
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    filter: "blur(4px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    filter: "blur(4px)",
  }),
};

export default function StudyPlanner() {
  const { ids: favoriteIds } = useFavorites();
  const [phase, setPhase] = useState<Phase>("wizard");
  const [wizStep, setWizStep] = useState<WizardStep>(1);
  const [slideDir, setSlideDir] = useState(1);
  const [prefs, setPrefs] = useState<StudyPreferences>(() => ({
    ...defaultPreferences(),
    favoriteRoomIds: favoriteIds,
  }));
  const [result, setResult] = useState<ScheduleRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const goTo = (step: WizardStep) => {
    setSlideDir(step > wizStep ? 1 : -1);
    setWizStep(step);
  };

  const next = () => {
    if (wizStep < 3) goTo((wizStep + 1) as WizardStep);
  };

  const prev = () => {
    if (wizStep > 1) goTo((wizStep - 1) as WizardStep);
  };

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

  const visibleRooms = useMemo(() => {
    return ROOMS.filter((r) => {
      if (prefs.locationPreference !== "any" && r.locationId !== prefs.locationPreference) return false;
      if (r.capacity < prefs.groupSize) return false;
      return true;
    });
  }, [prefs.locationPreference, prefs.groupSize]);

  const FLOOR_ORDER: Record<string, number> = { "Lower": 0, "Ground": 1, "1st": 2, "2nd": 3, "3rd": 4, "4th": 5 };

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

  const floorFilteredRooms = useMemo(() => {
    if (prefs.floorPreferences.length === 0) return visibleRooms;
    return visibleRooms.filter((r) => prefs.floorPreferences.includes(r.floor));
  }, [visibleRooms, prefs.floorPreferences]);

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

  // Summary chips
  const summaryChips: { label: string; step: WizardStep }[] = [];
  summaryChips.push({ label: `${prefs.sessionsPerWeek}x / week`, step: 1 });
  summaryChips.push({ label: formatDurationLong(prefs.sessionDuration), step: 1 });
  if (prefs.dayPreferences.length > 0 && prefs.dayPreferences.length < 7) {
    summaryChips.push({ label: prefs.dayPreferences.map((d) => DAY_NAMES[d.day]).join(", "), step: 2 });
  }
  if (prefs.timePreference.type !== "flexible") {
    const labels: Record<string, string> = { morning: "Mornings", afternoon: "Afternoons", evening: "Evenings", custom: "Custom time" };
    summaryChips.push({ label: labels[prefs.timePreference.type] || "", step: 2 });
  }
  if (prefs.locationPreference !== "any") {
    const loc = LOCATIONS.find((l) => l.id === prefs.locationPreference);
    if (loc) summaryChips.push({ label: loc.shortName, step: 3 });
  }
  if (prefs.groupSize > 1) summaryChips.push({ label: `${prefs.groupSize}+ seats`, step: 3 });

  const runPlanner = useCallback(async () => {
    setPhase("loading");
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
        setPhase("wizard");
        return;
      }

      setProgress({ current: 0, total: targetDates.length });

      const groupsToFetch: { lid: number; gid: number }[] = [];
      const locs = prefs.locationPreference === "any"
        ? LOCATIONS
        : LOCATIONS.filter((l) => l.id === prefs.locationPreference);
      for (const loc of locs) {
        for (const group of loc.groups) {
          if (group.name === "Study Rooms") {
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
        setPhase("wizard");
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
      setPhase("results");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("wizard");
    }
  }, [prefs, favoriteIds]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 dark:bg-surface-dark/80 border-b border-border dark:border-border-dark">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border dark:border-border-dark text-muted hover:text-foreground hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer shrink-0"
                aria-label="Back to dashboard"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </Link>
              <h1 className="text-lg font-bold text-foreground leading-tight">Study Planner</h1>
            </div>

            {/* Step indicator dots — wizard only */}
            {phase === "wizard" && (
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    onClick={() => goTo(s as WizardStep)}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      s === wizStep
                        ? "w-6 h-2 bg-primary dark:bg-secondary"
                        : s < wizStep
                          ? "w-2 h-2 bg-primary/40 dark:bg-secondary/40"
                          : "w-2 h-2 bg-slate-300 dark:bg-slate-600"
                    }`}
                    aria-label={`Go to step ${s}`}
                  />
                ))}
              </div>
            )}

            {phase === "results" && (
              <button
                onClick={() => { setPhase("wizard"); setWizStep(1); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border dark:border-border-dark text-muted hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col">
        {error && (
          <div className="rounded-xl border border-booked/30 bg-booked/5 p-4 text-sm text-booked flex items-start gap-3 mb-5" role="alert">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── WIZARD ── */}
        {phase === "wizard" && (
          <div className="flex-1 flex flex-col">
            {/* Step content area */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait" custom={slideDir}>
                <motion.div
                  key={wizStep}
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="space-y-5"
                >
                  {/* Step header */}
                  <div className="pt-2 pb-1">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-5xl sm:text-6xl text-primary/15 dark:text-secondary/15 leading-none select-none"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {wizStep}
                      </span>
                      <div>
                        <h2
                          className="text-2xl sm:text-3xl text-foreground leading-tight"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {STEP_TITLES[wizStep]}
                        </h2>
                        <p className="text-sm text-muted mt-0.5">{STEP_SUBTITLES[wizStep]}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── STEP 1: Frequency ── */}
                  {wizStep === 1 && (
                    <div className="space-y-6">
                      <fieldset className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 sm:p-6 space-y-6">
                        <legend className="sr-only">Study frequency</legend>

                        {/* Sessions per week */}
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider" id="sessions-label">Sessions per week</label>
                          <div className="flex gap-1.5 sm:gap-2" role="radiogroup" aria-labelledby="sessions-label">
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <button
                                key={n}
                                onClick={() => updatePref("sessionsPerWeek", n)}
                                role="radio"
                                aria-checked={prefs.sessionsPerWeek === n}
                                className={`flex-1 min-w-[36px] sm:min-w-[44px] h-11 sm:h-12 rounded-xl text-sm font-bold transition-all cursor-pointer border-2 ${
                                  prefs.sessionsPerWeek === n
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                                    : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30 hover:bg-primary/5 dark:hover:bg-secondary/5"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider" id="duration-label">Duration each session</label>
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="radiogroup" aria-labelledby="duration-label">
                            {DURATION_OPTIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                onClick={() => updatePref("sessionDuration", value)}
                                role="radio"
                                aria-checked={prefs.sessionDuration === value}
                                className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border-2 ${
                                  prefs.sessionDuration === value
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                                    : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {prefs.sessionDuration === 240 && (
                            <p className="text-[11px] text-accent font-medium">Maximum allowed per UCSC Library policy.</p>
                          )}
                        </div>
                      </fieldset>

                      {/* Visual summary */}
                      <div className="rounded-2xl bg-primary/5 dark:bg-secondary/5 border border-primary/10 dark:border-secondary/10 p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 dark:bg-secondary/10 flex items-center justify-center shrink-0">
                            <span className="text-2xl font-bold text-primary dark:text-secondary" style={{ fontFamily: "var(--font-display)" }}>
                              {prefs.sessionsPerWeek * Math.round(prefs.sessionDuration / 60 * 10) / 10}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {formatDurationLong(prefs.sessionsPerWeek * prefs.sessionDuration)} per week
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {prefs.sessionsPerWeek} session{prefs.sessionsPerWeek > 1 ? "s" : ""} of {formatDurationLong(prefs.sessionDuration)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 2: When ── */}
                  {wizStep === 2 && (
                    <div className="space-y-6">
                      {/* Days */}
                      <fieldset className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 sm:p-6 space-y-4">
                        <legend className="sr-only">Preferred days and times</legend>

                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider" id="days-label">Preferred days</label>
                          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-labelledby="days-label">
                            {DAY_NAMES.map((name, i) => (
                              <button
                                key={i}
                                onClick={() => toggleDay(i)}
                                aria-pressed={isDaySelected(i)}
                                className={`h-12 sm:h-14 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border-2 flex flex-col items-center justify-center gap-0.5 ${
                                  isDaySelected(i)
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                                    : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30"
                                }`}
                              >
                                <span className="text-[9px] sm:text-[10px] opacity-60 hidden sm:block">{DAY_NAMES_FULL[i].slice(0, 3)}</span>
                                <span>{name}</span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted">
                            {prefs.dayPreferences.length === 0
                              ? "No days selected — will check all days"
                              : `${prefs.dayPreferences.length} day${prefs.dayPreferences.length > 1 ? "s" : ""} selected`}
                          </p>
                        </div>

                        <div className="border-t border-border dark:border-border-dark" />

                        {/* Time of day */}
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider" id="time-label">Preferred time</label>
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2" role="radiogroup" aria-labelledby="time-label">
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
                                aria-checked={prefs.timePreference.type === type}
                                className={`p-4 min-h-[68px] rounded-xl text-left transition-all cursor-pointer border-2 flex flex-col justify-center ${
                                  prefs.timePreference.type === type
                                    ? "bg-primary/8 border-primary/40 dark:bg-secondary/10 dark:border-secondary/40 shadow-sm"
                                    : "border-border dark:border-border-dark hover:border-primary/20 dark:hover:border-secondary/20 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <svg className={`w-4.5 h-4.5 shrink-0 ${prefs.timePreference.type === type ? "text-primary dark:text-secondary" : "text-muted"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                                  </svg>
                                  <span className={`text-sm font-semibold ${prefs.timePreference.type === type ? "text-primary dark:text-secondary" : "text-foreground"}`}>
                                    {label}
                                  </span>
                                </div>
                                <span className="text-[11px] text-muted mt-1 pl-7">{sub}</span>
                              </button>
                            ))}
                          </div>

                          {prefs.timePreference.type !== "flexible" && prefs.timePreference.type !== "custom" && (
                            <button
                              onClick={() => updatePref("timePreference", {
                                type: "custom",
                                customStart: prefs.timePreference.type === "morning" ? 7 : prefs.timePreference.type === "afternoon" ? 12 : 17,
                                customEnd: prefs.timePreference.type === "morning" ? 12 : prefs.timePreference.type === "afternoon" ? 17 : 22,
                              })}
                              className="inline-flex items-center gap-1.5 text-xs text-primary dark:text-secondary hover:underline cursor-pointer min-h-[32px] font-medium"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              Set exact hours instead
                            </button>
                          )}

                          {prefs.timePreference.type === "custom" && (
                            <div className="flex items-end gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border dark:border-border-dark">
                              <div className="space-y-1.5 flex-1">
                                <label htmlFor="time-from" className="text-xs font-medium text-muted">From</label>
                                <select
                                  id="time-from"
                                  value={prefs.timePreference.customStart ?? 8}
                                  onChange={(e) => updatePref("timePreference", { ...prefs.timePreference, customStart: parseInt(e.target.value) })}
                                  className="w-full px-3 py-2 rounded-lg text-sm border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                                  className="w-full px-3 py-2 rounded-lg text-sm border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    </div>
                  )}

                  {/* ── STEP 3: Where ── */}
                  {wizStep === 3 && (
                    <div className="space-y-5">
                      {/* Building picker with library images */}
                      <fieldset className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
                        <legend className="sr-only">Building and room preferences</legend>

                        <div className="p-5 sm:p-6 space-y-3">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider">Building</label>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <button
                              onClick={() => { updatePref("locationPreference", "any"); updatePref("floorPreferences", []); }}
                              className={`h-12 sm:h-14 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border-2 ${
                                prefs.locationPreference === "any"
                                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                  : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30"
                              }`}
                            >
                              Either
                            </button>
                            {LOCATIONS.map((loc) => (
                              <button
                                key={loc.id}
                                onClick={() => { updatePref("locationPreference", loc.id); updatePref("floorPreferences", []); if (prefs.roomFilter === "custom") updatePref("selectedRoomIds", []); }}
                                className={`h-12 sm:h-14 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border-2 relative overflow-hidden ${
                                  prefs.locationPreference === loc.id
                                    ? "border-primary shadow-md shadow-primary/20 text-white"
                                    : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30"
                                }`}
                              >
                                {prefs.locationPreference === loc.id && LIBRARY_IMAGES[loc.id] && (
                                  <>
                                    <Image src={LIBRARY_IMAGES[loc.id]} alt="" fill className="object-cover" />
                                    <div className="absolute inset-0 bg-primary/70" />
                                  </>
                                )}
                                <span className="relative z-10">{loc.shortName}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Library photo preview */}
                        {prefs.locationPreference !== "any" && LIBRARY_IMAGES[prefs.locationPreference as number] && (
                          <div className="relative h-28 overflow-hidden">
                            <Image
                              src={LIBRARY_IMAGES[prefs.locationPreference as number]}
                              alt={LOCATIONS.find((l) => l.id === prefs.locationPreference)?.name || ""}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card dark:from-card-dark via-transparent to-card/30 dark:to-card-dark/30" />
                            <div className="absolute bottom-3 left-5 right-5">
                              <p className="text-xs font-medium text-white/90 drop-shadow-md">
                                {LOCATIONS.find((l) => l.id === prefs.locationPreference)?.name}
                              </p>
                            </div>
                          </div>
                        )}
                      </fieldset>

                      {/* Advanced toggle */}
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border dark:border-border-dark text-xs font-semibold text-muted hover:text-foreground hover:border-primary/30 dark:hover:border-secondary/30 transition-colors cursor-pointer"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                        {showAdvanced ? "Hide advanced options" : "Customize further"}
                      </button>

                      {/* Advanced options */}
                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden space-y-4"
                          >
                            <fieldset className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 space-y-5">
                              <legend className="sr-only">Room preferences</legend>

                              <div className="space-y-1.5">
                                <label htmlFor="group-size" className="text-xs font-semibold text-muted uppercase tracking-wider">Group size</label>
                                <select
                                  id="group-size"
                                  value={prefs.groupSize}
                                  onChange={(e) => updatePref("groupSize", parseInt(e.target.value))}
                                  className="w-full px-3 py-2.5 min-h-[44px] rounded-xl text-sm border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
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

                              {/* Floor filter */}
                              <div className="space-y-3">
                                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Floors</label>
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
                                                ? "border-border dark:border-border-dark text-muted/30 cursor-not-allowed line-through"
                                                : isSelected
                                                  ? "bg-primary text-white border-primary shadow-sm cursor-pointer"
                                                  : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30 cursor-pointer"
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
                                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Which rooms?</label>
                                <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                                  {([
                                    { value: "all" as const, label: "All rooms", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
                                    { value: "favorites" as const, label: "Favorites", icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" },
                                    { value: "custom" as const, label: "Pick rooms", icon: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
                                  ]).map(({ value, label, icon }) => (
                                    <button
                                      key={value}
                                      onClick={() => { updatePref("roomFilter", value); if (value !== "custom") updatePref("selectedRoomIds", []); }}
                                      role="radio"
                                      aria-checked={prefs.roomFilter === value}
                                      disabled={value === "favorites" && favoriteIds.length === 0}
                                      className={`flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                        prefs.roomFilter === value
                                          ? "bg-primary/10 border-primary/40 text-primary dark:text-secondary dark:bg-primary/20 shadow-sm"
                                          : value === "favorites" && favoriteIds.length === 0
                                            ? "border-border dark:border-border-dark text-muted/40 cursor-not-allowed"
                                            : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-primary/30"
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
                                  <p className="text-[11px] text-muted">Only your {favoriteIds.length} favorite{favoriteIds.length > 1 ? " rooms" : " room"} will be considered.</p>
                                )}
                                {prefs.roomFilter === "all" && favoriteIds.length > 0 && (
                                  <p className="text-[11px] text-muted">All eligible rooms — {favoriteIds.length} favorite{favoriteIds.length > 1 ? "s" : ""} will be scored higher.</p>
                                )}
                              </div>

                              {/* Room picker */}
                              {prefs.roomFilter === "custom" && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] text-muted">
                                      {prefs.selectedRoomIds.length === 0
                                        ? "No rooms selected — all eligible rooms will be used"
                                        : `${prefs.selectedRoomIds.length} room${prefs.selectedRoomIds.length > 1 ? "s" : ""} selected`}
                                    </p>
                                    {prefs.selectedRoomIds.length > 0 && (
                                      <button onClick={() => updatePref("selectedRoomIds", [])} className="text-[11px] text-primary dark:text-secondary hover:underline cursor-pointer">Clear all</button>
                                    )}
                                  </div>
                                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
                                    {roomsByGroup.map(({ label, rooms }) => (
                                      <div key={label}>
                                        <div className="sticky top-0 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm">
                                          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</span>
                                        </div>
                                        {rooms.map((room) => (
                                          <label key={room.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                            <input type="checkbox" checked={prefs.selectedRoomIds.includes(room.id)} onChange={() => toggleSelectedRoom(room.id)} className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0" />
                                            <div className="flex-1 min-w-0"><span className="text-sm text-foreground truncate block">{room.name}</span></div>
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
                                      <div className="px-3 py-6 text-center text-xs text-muted">No rooms match your current filters.</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </fieldset>

                            {/* Scheduling style */}
                            <fieldset className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 space-y-4">
                              <legend className="sr-only">Scheduling style</legend>
                              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Scheduling style</label>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
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
                                    className={`p-3 min-h-[60px] rounded-xl text-left transition-all cursor-pointer border-2 flex flex-col justify-center ${
                                      prefs.schedulingStyle === value
                                        ? "bg-primary/8 border-primary/40 dark:bg-secondary/10 dark:border-secondary/40 shadow-sm"
                                        : "border-border dark:border-border-dark hover:border-primary/20 dark:hover:border-secondary/20 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <svg className={`w-4 h-4 shrink-0 ${prefs.schedulingStyle === value ? "text-primary dark:text-secondary" : "text-muted"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                                      </svg>
                                      <span className={`text-sm font-semibold ${prefs.schedulingStyle === value ? "text-primary dark:text-secondary" : "text-foreground"}`}>{label}</span>
                                    </div>
                                    <span className="text-[11px] text-muted mt-0.5 pl-6">{desc}</span>
                                  </button>
                                ))}
                              </div>

                              <label className="flex items-center gap-2.5 cursor-pointer min-h-[36px]">
                                <input type="checkbox" checked={prefs.preferSameRoom} onChange={(e) => updatePref("preferSameRoom", e.target.checked)} className="w-4.5 h-4.5 rounded accent-primary cursor-pointer" />
                                <span className="text-sm text-foreground">Prefer same room each session</span>
                              </label>
                            </fieldset>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Bottom bar: summary + navigation ── */}
            <div className="sticky bottom-0 bg-background pt-4 pb-5 -mx-4 px-4 border-t border-border dark:border-border-dark mt-6 space-y-3">
              {/* Summary chips */}
              {summaryChips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {summaryChips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(chip.step)}
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        chip.step === wizStep
                          ? "bg-primary/15 text-primary dark:text-secondary dark:bg-secondary/15 border border-primary/20 dark:border-secondary/20"
                          : "bg-slate-100 dark:bg-slate-800 text-muted hover:text-foreground"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Nav buttons */}
              <div className="flex items-center gap-3">
                {wizStep > 1 && (
                  <button
                    onClick={prev}
                    className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border-2 border-border dark:border-border-dark text-sm font-medium text-muted hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                )}

                {wizStep < 3 ? (
                  <button
                    onClick={next}
                    className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-light active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    Continue
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={runPlanner}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-light active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    Find my schedule
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6 max-w-xs">
              {/* Animated rings */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-[3px] border-primary/10 dark:border-secondary/10 rounded-full" />
                <div className="absolute inset-0 border-[3px] border-transparent border-t-primary dark:border-t-secondary rounded-full animate-spin" />
                <div className="absolute inset-2 border-[2px] border-transparent border-b-accent rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary dark:text-secondary tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  Scanning availability
                </p>
                <p className="text-xs text-muted mt-1.5">
                  Checking {progress.total} {progress.total === 1 ? "day" : "days"} across all rooms
                </p>
              </div>

              {progress.total > 0 && (
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* Summary of what we're looking for */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {summaryChips.slice(0, 4).map((chip, i) => (
                  <span key={i} className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-muted">
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && result && (
          <div className="space-y-5">
            {/* Summary banner */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`rounded-2xl border p-5 ${
                result.blocks.length >= prefs.sessionsPerWeek
                  ? "border-available/30 bg-available/5"
                  : result.blocks.length > 0
                    ? "border-accent/30 bg-accent/5"
                    : "border-booked/30 bg-booked/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
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
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {summaryChips.slice(0, 4).map((chip, i) => (
                      <span key={i} className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-muted">
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Result cards */}
            {result.blocks.length > 0 ? (
              <div className="space-y-3">
                {result.blocks.map((block, i) => (
                  <motion.div
                    key={`${block.date}-${block.room.id}-${block.startTime}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.08 }}
                  >
                    <ResultCard block={block} index={i} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-8 text-center space-y-3"
              >
                <svg className="w-10 h-10 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">No matching slots found</p>
                <p className="text-xs text-muted max-w-xs mx-auto">Try different days, times, or a shorter duration.</p>
                <button
                  onClick={() => { setPhase("wizard"); setWizStep(1); }}
                  className="mt-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-light transition-colors cursor-pointer"
                >
                  Adjust preferences
                </button>
              </motion.div>
            )}

            {result.blocks.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setPhase("wizard"); setWizStep(1); }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-border dark:border-border-dark text-sm font-medium text-muted hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Adjust & re-run
                </button>
                <button
                  onClick={runPlanner}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors cursor-pointer shadow-sm"
                >
                  Re-scan availability
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border dark:border-border-dark py-4 mt-auto">
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
    <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden group">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 dark:border-border-dark/50">
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-secondary/10 text-primary dark:text-secondary text-sm font-bold flex items-center justify-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{formatDateShort(block.date)}</p>
            <p className="text-[11px] text-muted">{DAY_NAMES_FULL[new Date(block.date + "T12:00:00").getDay()]}</p>
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

      <div className="px-5 py-4 space-y-3">
        <div>
          <Link
            href={`/room/${block.room.id}?date=${block.date}`}
            className="text-sm font-semibold text-foreground hover:text-primary dark:hover:text-secondary transition-colors cursor-pointer"
          >
            {block.room.name}
          </Link>
          <p className="text-xs text-muted">
            {loc?.shortName} &middot; {block.room.floor} Floor &middot; {block.room.capacity} seats
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 rounded-xl bg-available/5 border border-available/15">
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              {formatTime(block.startTime)} – {formatTime(block.endTime)}
            </span>
            <span className="text-[11px] sm:text-xs text-muted ml-1.5 sm:ml-2">{formatDuration(block.durationMins)}</span>
          </div>
          <BookLink
            href={bookingUrl(block.room.id, { start: block.startTime, end: block.endTime, roomName: block.room.name })}
            slotDate={block.startTime.split(" ")[0]}
            today={todayStr()}
            className="px-4 py-2 min-h-[36px] rounded-xl bg-available text-white text-xs font-bold hover:bg-green-600 transition-colors cursor-pointer inline-flex items-center shadow-sm shadow-available/20"
          >
            Book
          </BookLink>
        </div>

        <details className="group/details">
          <summary className="text-[11px] text-muted cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1 min-h-[28px]">
            <svg className="w-3 h-3 transition-transform group-open/details:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
