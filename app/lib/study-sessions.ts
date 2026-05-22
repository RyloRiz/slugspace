"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Types ──

export interface StudySession {
  id: string;
  roomId: number;
  roomName: string;
  date: string;            // YYYY-MM-DD
  startTime: number;       // epoch ms
  endTime: number;         // epoch ms
  duration: number;        // minutes studied
  mode: "focus" | "pomodoro";
  pomodorosCompleted: number;
  productivity?: number;   // 1-5
  note?: string;
}

export interface ActiveTimer {
  id: string;
  roomId: number;
  roomName: string;
  date: string;
  scheduledStart: number;  // epoch ms when session is scheduled to begin (0 = immediate/already active)
  startTime: number;       // epoch ms when timer actually started counting (0 if still scheduled)
  plannedEnd: number;      // epoch ms (0 = manual/no end)
  mode: "focus" | "pomodoro";
  pomodoroWork: number;    // minutes (default 25)
  pomodoroBreak: number;   // minutes (default 5)
  pomodorosCompleted: number;
  currentPhase: "work" | "break";
  phaseStartTime: number;  // epoch ms when current phase started (0 if still scheduled)
  paused: boolean;
  pausedAt?: number;       // epoch ms
  accumulatedPauseMs: number;
  warned15: boolean;
  warned5: boolean;
  warnedPre15: boolean;    // 15 min before scheduled start
  warnedPre5: boolean;     // 5 min before scheduled start
  warnedStart: boolean;    // at scheduled start time
  minimized: boolean;
}

export interface StudyGoal {
  weeklyMinutes: number;
}

export interface StudyStats {
  thisWeekMinutes: number;
  thisWeekSessions: number;
  currentStreak: number;
  longestStreak: number;
  topRooms: { roomId: number; roomName: string; count: number }[];
  avgDuration: number;
  mostProductiveDay: string | null;
}

// ── Sessions Storage ──

const SESSIONS_KEY = "ucsc-study-sessions";
const MAX_SESSIONS = 200;
const sessionsListeners = new Set<() => void>();

function emitSessions() {
  sessionsListeners.forEach((fn) => fn());
}

function readSessions(): StudySession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSessions(sessions: StudySession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  emitSessions();
}

function subscribeSessions(fn: () => void) {
  sessionsListeners.add(fn);
  return () => sessionsListeners.delete(fn);
}

function getSessionsSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(SESSIONS_KEY) || "[]";
}

function getSessionsServerSnapshot(): string {
  return "[]";
}

// ── Timer Storage (supports multiple timers) ──

const TIMER_KEY = "ucsc-study-timer";
const timerListeners = new Set<() => void>();

function emitTimer() {
  timerListeners.forEach((fn) => fn());
}

function readTimers(): ActiveTimer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Migrate from single-timer format
    if (parsed && !Array.isArray(parsed) && parsed.id) return [parsed];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTimers(timers: ActiveTimer[]) {
  if (timers.length > 0) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
  } else {
    localStorage.removeItem(TIMER_KEY);
  }
  emitTimer();
}

function updateTimer(id: string, updater: (t: ActiveTimer) => ActiveTimer) {
  const timers = readTimers();
  const idx = timers.findIndex((t) => t.id === id);
  if (idx === -1) return;
  timers[idx] = updater(timers[idx]);
  writeTimers(timers);
}

function removeTimer(id: string) {
  writeTimers(readTimers().filter((t) => t.id !== id));
}

function subscribeTimer(fn: () => void) {
  timerListeners.add(fn);
  return () => timerListeners.delete(fn);
}

function getTimerSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(TIMER_KEY) || "[]";
}

function getTimerServerSnapshot(): string {
  return "[]";
}

// ── Goal Storage ──

const GOAL_KEY = "ucsc-study-goal";
const goalListeners = new Set<() => void>();

function emitGoal() {
  goalListeners.forEach((fn) => fn());
}

function readGoal(): StudyGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeGoal(goal: StudyGoal | null) {
  if (goal) {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  } else {
    localStorage.removeItem(GOAL_KEY);
  }
  emitGoal();
}

function subscribeGoal(fn: () => void) {
  goalListeners.add(fn);
  return () => goalListeners.delete(fn);
}

function getGoalSnapshot(): string {
  if (typeof window === "undefined") return "null";
  return localStorage.getItem(GOAL_KEY) || "null";
}

function getGoalServerSnapshot(): string {
  return "null";
}

// ── Timer helpers ──

/** Timer is in scheduled state (waiting for session start time) */
export function isTimerScheduled(timer: ActiveTimer): boolean {
  return timer.scheduledStart > 0 && timer.startTime === 0;
}

/** Ms until the scheduled session begins */
export function getScheduledInMs(timer: ActiveTimer): number {
  if (!isTimerScheduled(timer)) return 0;
  return Math.max(0, timer.scheduledStart - Date.now());
}

export function getElapsedMs(timer: ActiveTimer): number {
  if (isTimerScheduled(timer)) return 0;
  const now = timer.paused && timer.pausedAt ? timer.pausedAt : Date.now();
  return now - timer.startTime - timer.accumulatedPauseMs;
}

export function getRemainingMs(timer: ActiveTimer): number | null {
  if (isTimerScheduled(timer)) return null;
  if (timer.plannedEnd === 0) return null; // manual session, no end
  const total = timer.plannedEnd - timer.startTime;
  const elapsed = getElapsedMs(timer);
  return Math.max(0, total - elapsed);
}

export function getPhaseRemainingMs(timer: ActiveTimer): number {
  const phaseDuration = timer.currentPhase === "work"
    ? timer.pomodoroWork * 60000
    : timer.pomodoroBreak * 60000;
  const now = timer.paused && timer.pausedAt ? timer.pausedAt : Date.now();
  const phaseElapsed = now - timer.phaseStartTime - (timer.paused ? 0 : 0);
  return Math.max(0, phaseDuration - phaseElapsed);
}

// ── Stats ──

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday as week start
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getStudyStats(sessions: StudySession[]): StudyStats {
  const weekStart = getWeekStart();
  const today = todayStr();

  // This week
  const thisWeek = sessions.filter((s) => s.date >= weekStart);
  const thisWeekMinutes = thisWeek.reduce((sum, s) => sum + s.duration, 0);
  const thisWeekSessions = thisWeek.length;

  // Streak: consecutive days with sessions working backwards from today
  const sessionDates = new Set(sessions.map((s) => s.date));
  let currentStreak = 0;
  const d = new Date(today + "T12:00:00");
  // Check today first — if no session today, start from yesterday
  if (!sessionDates.has(today)) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (sessionDates.has(ds)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak (scan all dates)
  let longestStreak = 0;
  if (sessions.length > 0) {
    const sortedDates = [...sessionDates].sort();
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T12:00:00");
      const curr = new Date(sortedDates[i] + "T12:00:00");
      const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
      if (diffDays === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // Top rooms
  const roomCounts = new Map<number, { roomName: string; count: number }>();
  for (const s of sessions) {
    const entry = roomCounts.get(s.roomId) || { roomName: s.roomName, count: 0 };
    entry.count++;
    roomCounts.set(s.roomId, entry);
  }
  const topRooms = [...roomCounts.entries()]
    .map(([roomId, { roomName, count }]) => ({ roomId, roomName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Average duration
  const avgDuration = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length)
    : 0;

  // Most productive day (by total minutes)
  let mostProductiveDay: string | null = null;
  if (sessions.length >= 5) {
    const dayMinutes = new Map<number, number>();
    for (const s of sessions) {
      const dow = new Date(s.date + "T12:00:00").getDay();
      dayMinutes.set(dow, (dayMinutes.get(dow) || 0) + s.duration);
    }
    let maxMin = 0;
    let maxDay = 0;
    dayMinutes.forEach((mins, dow) => {
      if (mins > maxMin) { maxMin = mins; maxDay = dow; }
    });
    mostProductiveDay = DAY_NAMES[maxDay];
  }

  return {
    thisWeekMinutes,
    thisWeekSessions,
    currentStreak,
    longestStreak,
    topRooms,
    avgDuration,
    mostProductiveDay,
  };
}

// ── Hooks ──

export function useStudySessions() {
  const raw = useSyncExternalStore(subscribeSessions, getSessionsSnapshot, getSessionsServerSnapshot);
  const sessions: StudySession[] = JSON.parse(raw);

  const addSession = useCallback((session: Omit<StudySession, "id">) => {
    const id = `${session.roomId}-${session.startTime}`;
    const current = readSessions();
    if (current.some((s) => s.id === id)) return;
    writeSessions([{ ...session, id }, ...current]);
  }, []);

  const removeSession = useCallback((id: string) => {
    writeSessions(readSessions().filter((s) => s.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    writeSessions([]);
  }, []);

  return { sessions, addSession, removeSession, clearAll };
}

/** Pick the "primary" timer to display: active (non-scheduled) first, then earliest scheduled */
export function getPrimaryTimer(timers: ActiveTimer[]): ActiveTimer | null {
  // Active timer (non-scheduled) takes priority
  const active = timers.find((t) => !isTimerScheduled(t));
  if (active) return active;
  // Otherwise, earliest scheduled
  const scheduled = timers.filter((t) => isTimerScheduled(t)).sort((a, b) => a.scheduledStart - b.scheduledStart);
  return scheduled[0] ?? null;
}

export function useStudyTimer() {
  const raw = useSyncExternalStore(subscribeTimer, getTimerSnapshot, getTimerServerSnapshot);
  const parsed = JSON.parse(raw);
  const timers: ActiveTimer[] = Array.isArray(parsed) ? parsed : parsed && parsed.id ? [parsed] : [];
  const timer = getPrimaryTimer(timers);

  const startTimer = useCallback((opts: {
    roomId: number;
    roomName: string;
    date: string;
    plannedEnd: number;
    mode: "focus" | "pomodoro";
    pomodoroWork?: number;
    pomodoroBreak?: number;
    scheduledStart?: number;
  }) => {
    const now = Date.now();
    const isScheduled = opts.scheduledStart && opts.scheduledStart > now + 60000;
    const newTimer: ActiveTimer = {
      id: `${opts.roomId}-${now}`,
      roomId: opts.roomId,
      roomName: opts.roomName,
      date: opts.date,
      scheduledStart: isScheduled ? opts.scheduledStart! : 0,
      startTime: isScheduled ? 0 : now,
      plannedEnd: opts.plannedEnd,
      mode: opts.mode,
      pomodoroWork: opts.pomodoroWork ?? 25,
      pomodoroBreak: opts.pomodoroBreak ?? 5,
      pomodorosCompleted: 0,
      currentPhase: "work",
      phaseStartTime: isScheduled ? 0 : now,
      paused: false,
      accumulatedPauseMs: 0,
      warned15: false,
      warned5: false,
      warnedPre15: false,
      warnedPre5: false,
      warnedStart: false,
      minimized: false,
    };
    writeTimers([...readTimers(), newTimer]);
  }, []);

  /** Transition a scheduled timer to active (start counting) */
  const activateTimer = useCallback((id: string) => {
    const now = Date.now();
    updateTimer(id, (t) => ({
      ...t,
      scheduledStart: 0,
      startTime: now,
      phaseStartTime: now,
    }));
  }, []);

  const stopTimer = useCallback((id: string) => {
    removeTimer(id);
  }, []);

  const pauseTimer = useCallback((id: string) => {
    updateTimer(id, (t) => t.paused ? t : { ...t, paused: true, pausedAt: Date.now() });
  }, []);

  const resumeTimer = useCallback((id: string) => {
    updateTimer(id, (t) => {
      if (!t.paused || !t.pausedAt) return t;
      const pausedDuration = Date.now() - t.pausedAt;
      return {
        ...t,
        paused: false,
        pausedAt: undefined,
        accumulatedPauseMs: t.accumulatedPauseMs + pausedDuration,
        phaseStartTime: t.phaseStartTime + pausedDuration,
      };
    });
  }, []);

  const completePomo = useCallback((id: string) => {
    updateTimer(id, (t) => {
      if (t.mode !== "pomodoro") return t;
      const nextPhase = t.currentPhase === "work" ? "break" : "work";
      const newPomos = t.currentPhase === "work" ? t.pomodorosCompleted + 1 : t.pomodorosCompleted;
      return {
        ...t,
        currentPhase: nextPhase as "work" | "break",
        phaseStartTime: Date.now(),
        pomodorosCompleted: newPomos,
      };
    });
  }, []);

  const setMinimized = useCallback((id: string, minimized: boolean) => {
    updateTimer(id, (t) => ({ ...t, minimized }));
  }, []);

  const setWarned = useCallback((id: string, which: "warned15" | "warned5" | "warnedPre15" | "warnedPre5" | "warnedStart") => {
    updateTimer(id, (t) => ({ ...t, [which]: true }));
  }, []);

  const dismiss = useCallback((id: string) => {
    removeTimer(id);
  }, []);

  return {
    timers,
    timer,
    startTimer,
    activateTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    completePomo,
    setMinimized,
    setWarned,
    dismiss,
  };
}

export function useStudyGoal() {
  const raw = useSyncExternalStore(subscribeGoal, getGoalSnapshot, getGoalServerSnapshot);
  const goal: StudyGoal | null = raw === "null" ? null : JSON.parse(raw);

  const setGoal = useCallback((weeklyMinutes: number | null) => {
    writeGoal(weeklyMinutes ? { weeklyMinutes } : null);
  }, []);

  return { goal, setGoal };
}

// ── Helpers for session lookup ──

export function findSessionForBooking(sessions: StudySession[], roomId: number, date: string): StudySession | undefined {
  return sessions.find((s) => s.roomId === roomId && s.date === date);
}

export function formatDurationShort(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
