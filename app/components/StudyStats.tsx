"use client";

import { useState, useMemo } from "react";
import {
  useStudySessions,
  useStudyGoal,
  useStudyTimer,
  getStudyStats,
  formatDurationShort,
} from "../lib/study-sessions";
import { requestNotificationPermission } from "../lib/alerts";
import SessionPrompt from "./SessionPrompt";
import Collapsible from "./ui/collapsible";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudyStats() {
  const { sessions } = useStudySessions();
  const { goal, setGoal } = useStudyGoal();
  const { timers, startTimer } = useStudyTimer();
  const [expanded, setExpanded] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  const stats = useMemo(() => getStudyStats(sessions), [sessions]);

  const goalProgress = goal
    ? Math.min(100, Math.round((stats.thisWeekMinutes / goal.weeklyMinutes) * 100))
    : null;

  const handleSaveGoal = () => {
    const hrs = parseFloat(goalInput);
    if (!isNaN(hrs) && hrs > 0 && hrs <= 168) {
      setGoal(Math.round(hrs * 60));
    }
    setEditingGoal(false);
    setGoalInput("");
  };

  const handleStartManual = async () => {
    setShowManualPrompt(true);
  };

  // Don't render if no sessions and no timers
  if (sessions.length === 0 && timers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-surface/50 dark:hover:bg-surface-dark/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-available/8 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-available" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              Study Sessions
            </p>
            <p className="text-[11px] text-muted">
              {stats.thisWeekSessions > 0
                ? `${formatDurationShort(stats.thisWeekMinutes)} this week · ${stats.thisWeekSessions} session${stats.thisWeekSessions !== 1 ? "s" : ""}`
                : `${sessions.length} session${sessions.length !== 1 ? "s" : ""} tracked`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.currentStreak > 0 && (
            <span className="text-[11px] font-bold text-accent tabular-nums flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.356 2.082a.75.75 0 01.638.174c3.24 2.886 5.006 6.25 5.006 9.744 0 1.837-.476 3.4-1.28 4.7a.75.75 0 01-1.31-.108c-.453-.998-1.14-1.768-1.975-2.305-.227.962-.666 1.82-1.286 2.525a.75.75 0 01-1.148-.036c-.577-.758-.882-1.668-.882-2.776 0-.698.14-1.367.395-1.998a8.93 8.93 0 01-1.52 2.523.75.75 0 01-1.22-.169A7.59 7.59 0 016 10c0-3.494 1.766-6.858 5.006-9.744a.75.75 0 01.638-.174l.356.082.356-.082z" />
              </svg>
              {stats.currentStreak}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      <Collapsible open={expanded}>
        <div className="border-t border-border dark:border-border-dark">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 divide-x divide-border dark:divide-border-dark">
            {/* This Week */}
            <div className="p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {stats.thisWeekMinutes >= 60
                  ? `${Math.floor(stats.thisWeekMinutes / 60)}h`
                  : `${stats.thisWeekMinutes}m`}
              </p>
              <p className="text-[10px] sm:text-[11px] text-muted font-medium mt-0.5">This Week</p>
            </div>

            {/* Sessions */}
            <div className="p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {stats.thisWeekSessions}
              </p>
              <p className="text-[10px] sm:text-[11px] text-muted font-medium mt-0.5">Sessions</p>
            </div>

            {/* Streak */}
            <div className="p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                  {stats.currentStreak}
                </p>
                {stats.currentStreak > 0 && (
                  <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.356 2.082a.75.75 0 01.638.174c3.24 2.886 5.006 6.25 5.006 9.744 0 1.837-.476 3.4-1.28 4.7a.75.75 0 01-1.31-.108c-.453-.998-1.14-1.768-1.975-2.305-.227.962-.666 1.82-1.286 2.525a.75.75 0 01-1.148-.036c-.577-.758-.882-1.668-.882-2.776 0-.698.14-1.367.395-1.998a8.93 8.93 0 01-1.52 2.523.75.75 0 01-1.22-.169A7.59 7.59 0 016 10c0-3.494 1.766-6.858 5.006-9.744a.75.75 0 01.638-.174l.356.082.356-.082z" />
                  </svg>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted font-medium mt-0.5">
                Day Streak
              </p>
              {stats.longestStreak > stats.currentStreak && (
                <p className="text-[9px] text-muted/60 mt-0.5">Best: {stats.longestStreak}</p>
              )}
            </div>
          </div>

          {/* Weekly Goal */}
          <div className="px-5 py-3 border-t border-border dark:border-border-dark">
            {editingGoal ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Hours per week"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveGoal()}
                  className="flex-1 px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-available/30"
                  min={1}
                  max={168}
                  step={0.5}
                  autoFocus
                />
                <button
                  onClick={handleSaveGoal}
                  className="px-3 py-2 rounded-lg bg-available text-white text-xs font-bold cursor-pointer"
                >
                  Set
                </button>
                <button
                  onClick={() => { setEditingGoal(false); setGoalInput(""); }}
                  className="px-3 py-2 rounded-lg border border-border dark:border-border-dark text-xs text-muted cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : goal ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold text-muted">
                    Weekly Goal: {formatDurationShort(goal.weeklyMinutes)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tabular-nums text-foreground">{goalProgress}%</span>
                    <button
                      onClick={() => { setEditingGoal(true); setGoalInput(String(goal.weeklyMinutes / 60)); }}
                      className="text-[10px] text-primary dark:text-secondary hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      goalProgress! >= 100 ? "bg-available" : "bg-primary dark:bg-secondary"
                    }`}
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                {goalProgress! >= 100 && (
                  <p className="text-[10px] text-available font-semibold mt-1">Goal reached!</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="w-full py-2 rounded-lg border border-dashed border-border dark:border-border-dark text-[11px] text-muted hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
              >
                Set a weekly study goal
              </button>
            )}
          </div>

          {/* Insights + Top Rooms */}
          {sessions.length >= 3 && (
            <div className="px-5 py-3 border-t border-border dark:border-border-dark space-y-2.5">
              {/* Insights */}
              <div className="flex flex-wrap gap-2">
                {stats.avgDuration > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface dark:bg-surface-dark text-[10px] text-muted">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Avg: {formatDurationShort(stats.avgDuration)}/session
                  </span>
                )}
                {stats.mostProductiveDay && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface dark:bg-surface-dark text-[10px] text-muted">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Best: {stats.mostProductiveDay}s
                  </span>
                )}
              </div>

              {/* Top rooms */}
              {stats.topRooms.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Top Rooms</p>
                  <div className="space-y-1">
                    {stats.topRooms.map((r) => (
                      <div key={r.roomId} className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground truncate">{r.roomName}</span>
                        <span className="text-[10px] text-muted tabular-nums shrink-0 ml-2">{r.count} session{r.count !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer with manual start */}
          <div className="px-5 py-3 border-t border-border dark:border-border-dark bg-surface/30 dark:bg-surface-dark/30 flex items-center justify-between">
            <button
              onClick={handleStartManual}
              disabled={false}
              className="text-[11px] font-semibold text-available hover:text-available/80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Manual Session
            </button>
            <ClearHistoryButton />
          </div>
        </div>
      </Collapsible>

      <SessionPrompt
        open={showManualPrompt}
        onClose={() => setShowManualPrompt(false)}
        roomId={0}
        roomName="Manual Session"
        date={todayStr()}
      />
    </div>
  );
}

function ClearHistoryButton() {
  const { clearAll } = useStudySessions();
  return (
    <button
      onClick={() => { if (confirm("Clear all study session history?")) clearAll(); }}
      className="text-[11px] text-muted hover:text-booked cursor-pointer font-medium"
    >
      Clear history
    </button>
  );
}
