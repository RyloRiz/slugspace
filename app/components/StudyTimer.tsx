"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  useStudyTimer,
  useStudySessions,
  getElapsedMs,
  getRemainingMs,
  getPhaseRemainingMs,
  getScheduledInMs,
  isTimerScheduled,
  formatDurationShort,
  ActiveTimer,
} from "../lib/study-sessions";
import { canNotify } from "../lib/alerts";
import { useBookingQueue } from "../lib/booking-queue";

// ── Helpers ──

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCountUp(ms: number): string {
  return formatCountdown(ms);
}

function formatEndTime(epoch: number): string {
  const d = new Date(epoch);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Progress Ring ──

function ProgressRing({
  progress,
  size,
  strokeWidth,
  phase,
  warning,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  phase: "work" | "break";
  warning: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-surface dark:stroke-surface-dark"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className={
          warning
            ? "stroke-booked transition-[stroke-dashoffset] duration-1000"
            : phase === "break"
              ? "stroke-secondary transition-[stroke-dashoffset] duration-1000"
              : "stroke-available transition-[stroke-dashoffset] duration-1000"
        }
      />
    </svg>
  );
}

// ── Session Complete Modal ──

function SessionCompleteModal({
  timer,
  onSave,
  onDiscard,
}: {
  timer: ActiveTimer;
  onSave: (productivity?: number, note?: string) => void;
  onDiscard: () => void;
}) {
  const [productivity, setProductivity] = useState<number>(0);
  const [note, setNote] = useState("");

  const elapsed = getElapsedMs(timer);
  const duration = Math.round(elapsed / 60000);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onDiscard}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl bg-card dark:bg-card-dark shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)] overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
      >
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-available via-available to-secondary" />

        <div className="px-6 pt-5 pb-6 space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-available/10">
              <svg className="h-5 w-5 text-available" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Session Complete
              </p>
              <p className="text-xs text-muted leading-tight mt-0.5">{timer.roomName}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-surface dark:bg-surface-dark p-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{formatDurationShort(duration)}</p>
              <p className="text-[10px] text-muted font-medium">Studied</p>
            </div>
            {timer.mode === "pomodoro" && (
              <div className="flex-1 rounded-xl bg-surface dark:bg-surface-dark p-3 text-center">
                <p className="text-lg font-bold text-foreground tabular-nums">{timer.pomodorosCompleted}</p>
                <p className="text-[10px] text-muted font-medium">Pomodoros</p>
              </div>
            )}
          </div>

          {/* Productivity rating */}
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">How productive?</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setProductivity(n === productivity ? 0 : n)}
                  className="flex-1 py-2.5 rounded-xl border transition-all cursor-pointer text-center"
                  style={{
                    borderColor: n <= productivity ? "var(--color-accent)" : "var(--color-border)",
                    backgroundColor: n <= productivity ? "rgba(253, 199, 0, 0.1)" : "transparent",
                  }}
                >
                  <span className={`text-sm ${n <= productivity ? "opacity-100" : "opacity-30"}`}>
                    {["", "😴", "😐", "🙂", "😊", "🔥"][n]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <input
              type="text"
              placeholder="What did you work on? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={100}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={onDiscard}
              className="flex-1 rounded-xl border border-border dark:border-border-dark px-4 py-2.5 text-[13px] font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={() => onSave(productivity || undefined, note || undefined)}
              className="flex-1 rounded-xl bg-available px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-available/90 transition-colors cursor-pointer"
            >
              Save Session
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Timer Widget ──

export default function StudyTimer() {
  const { timers, timer, activateTimer, stopTimer, pauseTimer, resumeTimer, completePomo, setMinimized, setWarned, dismiss } = useStudyTimer();
  const { addSession } = useStudySessions();
  const { count: queueCount } = useBookingQueue();
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedTimerRef = useRef<ActiveTimer | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scheduled = timer ? isTimerScheduled(timer) : false;
  const scheduledCount = timers.filter((t) => isTimerScheduled(t)).length;

  // Tick interval for display updates (runs when any timer exists)
  useEffect(() => {
    if (timers.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timers.length]);

  // Page Visibility API — pause interval when hidden
  useEffect(() => {
    if (timers.length === 0) return;

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setTick((t) => t + 1);
        intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [timers.length]);

  // Warning notifications for ALL active (non-scheduled) timers
  useEffect(() => {
    for (const t of timers) {
      if (t.paused || t.plannedEnd === 0 || isTimerScheduled(t)) continue;
      const remaining = getRemainingMs(t);
      if (remaining === null) continue;

      if (remaining <= 5 * 60000 && !t.warned5) {
        setWarned(t.id, "warned5");
        if (canNotify()) {
          new Notification("5 minutes left!", {
            body: `Your session at ${t.roomName} ends soon.`,
            tag: `timer-warn-5-${t.id}`,
          });
        }
      } else if (remaining <= 15 * 60000 && !t.warned15) {
        setWarned(t.id, "warned15");
        if (canNotify()) {
          new Notification("15 minutes left", {
            body: `Your session at ${t.roomName} has 15 minutes remaining.`,
            tag: `timer-warn-15-${t.id}`,
          });
        }
      }
    }
  });

  // Pre-session notifications + auto-activation for ALL scheduled timers
  useEffect(() => {
    for (const t of timers) {
      if (!isTimerScheduled(t)) continue;
      const msUntilStart = getScheduledInMs(t);

      if (msUntilStart <= 0) {
        if (!t.warnedStart) {
          setWarned(t.id, "warnedStart");
          if (canNotify()) {
            new Notification("Study session starting!", {
              body: `Time to head to ${t.roomName}. Your timer is now running.`,
              tag: `timer-start-${t.id}`,
            });
          }
        }
        activateTimer(t.id);
        continue;
      }

      if (msUntilStart <= 5 * 60000 && !t.warnedPre5) {
        setWarned(t.id, "warnedPre5");
        if (canNotify()) {
          new Notification("5 minutes until your session!", {
            body: `Head to ${t.roomName} — your study session starts soon.`,
            tag: `timer-pre5-${t.id}`,
          });
        }
      } else if (msUntilStart <= 15 * 60000 && !t.warnedPre15) {
        setWarned(t.id, "warnedPre15");
        if (canNotify()) {
          new Notification("15 minutes until your session", {
            body: `Your session at ${t.roomName} starts in 15 minutes.`,
            tag: `timer-pre15-${t.id}`,
          });
        }
      }
    }
  });

  // Pomodoro phase transitions for active timers
  useEffect(() => {
    for (const t of timers) {
      if (t.paused || t.mode !== "pomodoro" || isTimerScheduled(t)) continue;
      const phaseRemaining = getPhaseRemainingMs(t);
      if (phaseRemaining <= 0) {
        completePomo(t.id);
        if (canNotify()) {
          const nextPhase = t.currentPhase === "work" ? "Break" : "Focus";
          new Notification(`${nextPhase} time!`, {
            body: t.currentPhase === "work"
              ? `Great work! Take a ${t.pomodoroBreak}-minute break.`
              : `Break over! Time to focus.`,
            tag: `timer-pomo-${t.id}-${Date.now()}`,
          });
        }
      }
    }
  });

  // Auto-complete when planned end is reached
  useEffect(() => {
    for (const t of timers) {
      if (t.paused || t.plannedEnd === 0 || isTimerScheduled(t)) continue;
      const remaining = getRemainingMs(t);
      if (remaining !== null && remaining <= 0) {
        completedTimerRef.current = t;
        setShowComplete(true);
        break;
      }
    }
  });

  // Keyboard shortcut: Space to pause/resume (primary active timer only)
  useEffect(() => {
    if (!timer || scheduled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.paused) resumeTimer(timer.id);
        else pauseTimer(timer.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [timer?.id, timer?.paused, scheduled, pauseTimer, resumeTimer]);

  // Stale timer protection: discard if paused for more than 4 hours
  useEffect(() => {
    const now = Date.now();
    for (const t of timers) {
      if (t.paused && t.pausedAt && now - t.pausedAt > 4 * 60 * 60 * 1000) {
        dismiss(t.id);
      }
    }
  }, [timers, dismiss]);

  // Stale scheduled timer protection: discard if scheduled start passed by >2 hours
  useEffect(() => {
    const now = Date.now();
    for (const t of timers) {
      if (isTimerScheduled(t) && t.scheduledStart > 0 && now - t.scheduledStart > 2 * 60 * 60 * 1000) {
        dismiss(t.id);
      }
    }
  }, [timers, dismiss]);

  const handleSave = useCallback(
    (productivity?: number, note?: string) => {
      const t = completedTimerRef.current;
      if (!t) return;
      const elapsed = getElapsedMs(t);
      addSession({
        roomId: t.roomId,
        roomName: t.roomName,
        date: t.date,
        startTime: t.startTime,
        endTime: Date.now(),
        duration: Math.round(elapsed / 60000),
        mode: t.mode,
        pomodorosCompleted: t.pomodorosCompleted,
        productivity,
        note,
      });
      stopTimer(t.id);
      setShowComplete(false);
      completedTimerRef.current = null;
    },
    [addSession, stopTimer]
  );

  const handleManualStop = useCallback(() => {
    if (!timer || isTimerScheduled(timer)) return;
    completedTimerRef.current = timer;
    setShowComplete(true);
  }, [timer]);

  const handleCancelScheduled = useCallback(() => {
    if (!timer) return;
    dismiss(timer.id);
  }, [timer, dismiss]);

  const handleDiscard = useCallback(() => {
    const t = completedTimerRef.current;
    if (t) stopTimer(t.id);
    setShowComplete(false);
    completedTimerRef.current = null;
  }, [stopTimer]);

  if (!mounted) return null;

  // Compute display values
  const isManual = timer?.plannedEnd === 0;
  const elapsed = timer && !scheduled ? getElapsedMs(timer) : 0;
  const remaining = timer && !scheduled ? getRemainingMs(timer) : null;
  const scheduledIn = timer && scheduled ? getScheduledInMs(timer) : 0;
  const isWarning = !scheduled && remaining !== null && remaining <= 5 * 60000;
  const totalDuration = timer && !scheduled && timer.plannedEnd > 0 ? timer.plannedEnd - timer.startTime : 0;
  const progress = totalDuration > 0 ? elapsed / totalDuration : 0;

  // Pomodoro phase progress
  const phaseRemaining = timer && !scheduled && timer.mode === "pomodoro" ? getPhaseRemainingMs(timer) : 0;
  const phaseDuration = timer
    ? (timer.currentPhase === "work" ? timer.pomodoroWork : timer.pomodoroBreak) * 60000
    : 0;
  const phaseProgress = phaseDuration > 0 ? 1 - phaseRemaining / phaseDuration : 0;

  const hasQueue = queueCount > 0;

  const content = (
    <>
      <AnimatePresence>
        {timer && !showComplete && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2 }}
            className={`fixed z-[60] ${
              timer.minimized
                ? hasQueue
                  ? "bottom-20 right-4 sm:right-5"
                  : "bottom-4 right-4 sm:bottom-5 sm:right-5"
                : hasQueue
                  ? "bottom-20 right-4 sm:right-5 left-4 sm:left-auto"
                  : "bottom-4 right-4 sm:bottom-5 sm:right-5 left-4 sm:left-auto"
            }`}
          >
            {timer.minimized ? (
              /* ── Minimized Pill ── */
              <button
                onClick={() => setMinimized(timer.id, false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg cursor-pointer transition-all w-full sm:w-auto ${
                  scheduled
                    ? "bg-primary/90 dark:bg-secondary/90 text-white shadow-primary/30 dark:shadow-secondary/30"
                    : isWarning
                      ? "bg-booked/95 text-white shadow-booked/30 animate-timer-warning"
                      : timer.paused
                        ? "bg-card dark:bg-card-dark border border-border dark:border-border-dark text-foreground shadow-black/10"
                        : "bg-available/95 text-white shadow-available/30"
                }`}
              >
                {/* Mini progress ring or scheduled icon */}
                <div className="shrink-0">
                  {scheduled ? (
                    <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <ProgressRing
                      progress={timer.mode === "pomodoro" ? phaseProgress : progress}
                      size={28}
                      strokeWidth={3}
                      phase={timer.currentPhase}
                      warning={isWarning}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold truncate">{timer.roomName}</p>
                  <p className="text-[10px] opacity-80 tabular-nums">
                    {scheduled
                      ? `Starts in ${formatCountdown(scheduledIn)}`
                      : timer.paused
                        ? "Paused"
                        : isManual
                          ? formatCountUp(elapsed)
                          : remaining !== null
                            ? formatCountdown(remaining)
                            : "—"}
                  </p>
                </div>
                {scheduled && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/20">
                    {scheduledCount > 1 ? `${scheduledCount} Scheduled` : "Scheduled"}
                  </span>
                )}
                {!scheduled && scheduledCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/20 dark:bg-secondary/20 text-primary dark:text-secondary">
                    +{scheduledCount}
                  </span>
                )}
                {!scheduled && timer.mode === "pomodoro" && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    timer.currentPhase === "break"
                      ? "bg-white/20"
                      : isWarning ? "bg-white/20" : "bg-white/20"
                  }`}>
                    {timer.currentPhase === "work" ? "Focus" : "Break"}
                  </span>
                )}
                <svg className="w-3.5 h-3.5 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            ) : (
              /* ── Expanded Card ── */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full sm:w-80 rounded-2xl bg-card dark:bg-card-dark border border-border dark:border-border-dark shadow-2xl shadow-black/20 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`relative flex h-2 w-2 shrink-0 ${scheduled ? "" : timer.paused ? "" : "animate-pulse"}`}>
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${
                        scheduled ? "bg-primary dark:bg-secondary" : isWarning ? "bg-booked" : timer.paused ? "bg-muted" : "bg-available"
                      }`} />
                    </span>
                    <p className="text-sm font-semibold text-foreground truncate">{timer.roomName}</p>
                  </div>
                  <button
                    onClick={() => setMinimized(timer.id, true)}
                    className="p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Minimize timer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>

                {scheduled ? (
                  /* ── Scheduled State ── */
                  <div className="px-4 py-5 flex flex-col items-center gap-4">
                    {/* Clock icon with countdown */}
                    <div className="relative flex items-center justify-center w-[120px] h-[120px]">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/15 dark:border-secondary/15" />
                      <div className="flex flex-col items-center">
                        <svg className="w-6 h-6 text-primary dark:text-secondary mb-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-2xl font-bold tabular-nums text-foreground" role="timer" aria-live="polite">
                          {formatCountdown(scheduledIn)}
                        </p>
                        <p className="text-[10px] text-muted">until session</p>
                      </div>
                    </div>

                    {/* Scheduled start time */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface dark:bg-surface-dark w-full justify-center">
                      <svg className="w-3.5 h-3.5 text-primary dark:text-secondary shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <p className="text-xs text-foreground font-medium">
                        Starts at {formatEndTime(timer.scheduledStart)}
                      </p>
                      {timer.plannedEnd > 0 && (
                        <span className="text-xs text-muted">– {formatEndTime(timer.plannedEnd)}</span>
                      )}
                    </div>

                    {/* Notification status */}
                    <p className="text-[11px] text-muted leading-relaxed text-center px-2">
                      {timer.warnedPre5
                        ? "Starting soon — get ready!"
                        : timer.warnedPre15
                          ? "You\u2019ll get a reminder at 5 min"
                          : "You\u2019ll get reminders at 15 min and 5 min before"}
                    </p>
                  </div>
                ) : (
                  /* ── Active Timer Display ── */
                  <>
                    <div className="px-4 py-5 flex flex-col items-center gap-3">
                      {/* Progress ring with time inside */}
                      <div className="relative">
                        <ProgressRing
                          progress={timer.mode === "pomodoro" ? phaseProgress : progress}
                          size={120}
                          strokeWidth={6}
                          phase={timer.currentPhase}
                          warning={isWarning}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className={`text-2xl font-bold tabular-nums ${isWarning ? "text-booked" : "text-foreground"}`} role="timer" aria-live="polite">
                            {timer.paused
                              ? formatCountdown(remaining ?? elapsed)
                              : isManual
                                ? formatCountUp(elapsed)
                                : remaining !== null
                                  ? formatCountdown(remaining)
                                  : "—"}
                          </p>
                          <p className="text-[10px] text-muted">
                            {timer.paused ? "paused" : isManual ? "elapsed" : "remaining"}
                          </p>
                        </div>
                      </div>

                      {/* Pomodoro phase indicator */}
                      {timer.mode === "pomodoro" && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                            timer.currentPhase === "work"
                              ? "bg-available/10 text-available"
                              : "bg-secondary/10 text-secondary"
                          }`}>
                            {timer.currentPhase === "work" ? "Focus" : "Break"}
                          </span>
                          <span className="text-[11px] text-muted tabular-nums">
                            {timer.pomodorosCompleted} pomo{timer.pomodorosCompleted !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {/* End time info */}
                      {timer.plannedEnd > 0 && (
                        <p className="text-[11px] text-muted">
                          Ends at {formatEndTime(timer.plannedEnd)}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Controls */}
                <div className="px-4 pb-4 flex gap-2">
                  {scheduled ? (
                    <button
                      onClick={handleCancelScheduled}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-booked/10 text-booked hover:bg-booked/20 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Timer
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => timer.paused ? resumeTimer(timer.id) : pauseTimer(timer.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          timer.paused
                            ? "bg-available text-white hover:bg-available/90"
                            : "bg-surface dark:bg-surface-dark text-foreground hover:bg-surface/80"
                        }`}
                      >
                        {timer.paused ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Resume
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                            Pause
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleManualStop}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-booked/10 text-booked hover:bg-booked/20 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                        End Session
                      </button>
                    </>
                  )}
                </div>

                {/* Keyboard hint - desktop only (active timers only) */}
                {!scheduled && (
                  <div className="hidden sm:block px-4 pb-3">
                    <p className="text-[10px] text-muted/50 text-center">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-surface dark:bg-surface-dark text-[9px] font-mono">Space</kbd> to {timer.paused ? "resume" : "pause"}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComplete && completedTimerRef.current && (
          <SessionCompleteModal
            timer={completedTimerRef.current}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        )}
      </AnimatePresence>
    </>
  );

  return createPortal(content, document.body);
}
