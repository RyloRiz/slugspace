"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStudyTimer } from "../lib/study-sessions";
import { requestNotificationPermission } from "../lib/alerts";

const SKIP_KEY = "ucsc-skip-timer-prompt";

function shouldSkip(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SKIP_KEY) === "1";
}

function setSkipForSession() {
  sessionStorage.setItem(SKIP_KEY, "1");
}

function formatTimeShort(datetime: string): string {
  const time = datetime.split(" ")[1];
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface SessionPromptProps {
  open: boolean;
  onClose: () => void;
  roomId: number;
  roomName: string;
  date: string;
  slotStart?: string;  // "YYYY-MM-DD HH:MM:SS"
  slotEnd?: string;     // "YYYY-MM-DD HH:MM:SS"
}

export default function SessionPrompt({
  open,
  onClose,
  roomId,
  roomName,
  date,
  slotStart,
  slotEnd,
}: SessionPromptProps) {
  const { startTimer } = useStudyTimer();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"focus" | "pomodoro">("focus");
  const [dontAsk, setDontAsk] = useState(false);
  const [pomodoroPreset, setPomodoroPreset] = useState<"25/5" | "50/10">("25/5");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleClose = () => {
    if (dontAsk) setSkipForSession();
    onClose();
  };

  const handleStart = async () => {
    // Request notification permission for timer warnings
    await requestNotificationPermission();

    let plannedEnd = 0;
    if (slotEnd) {
      const [datePart, timePart] = slotEnd.split(" ");
      const [h, m] = timePart.split(":");
      const endDate = new Date(`${datePart}T${h}:${m}:00`);
      plannedEnd = endDate.getTime();
    }

    const [work, brk] = pomodoroPreset === "50/10" ? [50, 10] : [25, 5];

    startTimer({
      roomId,
      roomName,
      date: date || today,
      plannedEnd,
      mode,
      pomodoroWork: work,
      pomodoroBreak: brk,
      scheduledStart: isFutureSlot ? slotStartEpoch : undefined,
    });

    onClose();
  };

  const handleManualStart = async () => {
    await requestNotificationPermission();
    startTimer({
      roomId,
      roomName,
      date: date || todayStr(),
      plannedEnd: 0,
      mode,
      pomodoroWork: pomodoroPreset === "50/10" ? 50 : 25,
      pomodoroBreak: pomodoroPreset === "50/10" ? 10 : 5,
    });
    onClose();
  };

  // Compute whether this is a future slot
  const today = todayStr();
  const isFutureDate = date > today;
  const slotStartEpoch = slotStart ? (() => {
    const [dp, tp] = slotStart.split(" ");
    const [h, m] = tp.split(":");
    return new Date(`${dp}T${h}:${m}:00`).getTime();
  })() : 0;
  const isFutureSlot = slotStartEpoch > Date.now() + 60000; // >1 min from now

  // Auto-dismiss for future dates (non-today) or user opted out
  const shouldDismiss = isFutureDate || shouldSkip();
  useEffect(() => {
    if (open && shouldDismiss) onCloseRef.current();
  }, [open, shouldDismiss]);

  if (!mounted || shouldDismiss) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-card dark:bg-card-dark shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)]"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label="Start study timer"
          >
            {/* Top accent band */}
            <div className="h-1 bg-gradient-to-r from-available via-available to-secondary" />

            <div className="px-6 pt-5 pb-6 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-available/10">
                  <svg className="h-5 w-5 text-available" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                    {isFutureSlot ? "Schedule Study Timer?" : "Start Study Timer?"}
                  </p>
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {roomName}
                  </p>
                </div>
              </div>

              {/* Time window */}
              {slotStart && slotEnd && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface dark:bg-surface-dark">
                  <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-muted">
                    {formatTimeShort(slotStart)} – {formatTimeShort(slotEnd)}
                  </p>
                </div>
              )}

              {/* Mode selector */}
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Timer Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode("focus")}
                    className={`py-3 rounded-xl border text-center transition-all cursor-pointer ${
                      mode === "focus"
                        ? "border-available bg-available/5 ring-1 ring-available/30"
                        : "border-border dark:border-border-dark hover:border-foreground/20"
                    }`}
                  >
                    <p className={`text-xs font-bold ${mode === "focus" ? "text-available" : "text-foreground"}`}>Focus</p>
                    <p className="text-[10px] text-muted mt-0.5">Countdown timer</p>
                  </button>
                  <button
                    onClick={() => setMode("pomodoro")}
                    className={`py-3 rounded-xl border text-center transition-all cursor-pointer ${
                      mode === "pomodoro"
                        ? "border-secondary bg-secondary/5 ring-1 ring-secondary/30"
                        : "border-border dark:border-border-dark hover:border-foreground/20"
                    }`}
                  >
                    <p className={`text-xs font-bold ${mode === "pomodoro" ? "text-secondary" : "text-foreground"}`}>Pomodoro</p>
                    <p className="text-[10px] text-muted mt-0.5">Work & break cycles</p>
                  </button>
                </div>
              </div>

              {/* Pomodoro presets */}
              {mode === "pomodoro" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPomodoroPreset("25/5")}
                    className={`flex-1 py-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      pomodoroPreset === "25/5"
                        ? "border-secondary bg-secondary/5 text-secondary"
                        : "border-border dark:border-border-dark text-muted"
                    }`}
                  >
                    25 / 5 min
                  </button>
                  <button
                    onClick={() => setPomodoroPreset("50/10")}
                    className={`flex-1 py-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      pomodoroPreset === "50/10"
                        ? "border-secondary bg-secondary/5 text-secondary"
                        : "border-border dark:border-border-dark text-muted"
                    }`}
                  >
                    50 / 10 min
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-border dark:border-border-dark px-4 py-2.5 text-[13px] font-medium text-muted hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                >
                  No thanks
                </button>
                <button
                  onClick={handleStart}
                  className="flex-1 rounded-xl bg-available px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-available/90 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {isFutureSlot ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  {isFutureSlot ? "Schedule Timer" : "Start Timer"}
                </button>
              </div>

              {/* Info for scheduled / Manual start + don't ask */}
              {isFutureSlot && (
                <p className="text-[11px] text-muted bg-surface dark:bg-surface-dark rounded-lg px-3 py-2 leading-relaxed">
                  Timer will auto-start at your session time. You&apos;ll get reminders 15 min and 5 min before.
                </p>
              )}
              <div className="flex items-center justify-between">
                {!isFutureSlot && (
                  <button
                    onClick={handleManualStart}
                    className="text-[11px] text-primary dark:text-secondary hover:underline cursor-pointer font-medium"
                  >
                    Start without end time
                  </button>
                )}
                {isFutureSlot && <span />}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dontAsk}
                    onChange={(e) => setDontAsk(e.target.checked)}
                    className="w-3 h-3 rounded border-border accent-primary cursor-pointer"
                  />
                  <span className="text-[10px] text-muted">Don&apos;t ask again</span>
                </label>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
