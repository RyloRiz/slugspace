"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, LOCATIONS } from "../../lib/rooms";
import { bookingUrl, homePageUrl } from "../../lib/booking-url";
import { useFavorites } from "../../lib/favorites";
import { isSlotAvailable, isSlotFuture } from "../../lib/slots";
import { SlotData } from "../../components/TimeGrid";

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

function formatTimeCompact(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "p" : "a";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  if (m === "00") return `${display}${ampm}`;
  return `${display}:${m}${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

interface SlotInfo {
  slot: SlotData;
  available: boolean;
  past: boolean;
}

interface Block {
  start: string;
  end: string;
  durationMins: number;
  slots: SlotData[];
}

function buildBlocks(slotInfos: SlotInfo[]): Block[] {
  const blocks: Block[] = [];
  let current: SlotData[] = [];
  for (const si of slotInfos) {
    if (si.available && !si.past) {
      current.push(si.slot);
    } else {
      if (current.length > 0) {
        blocks.push({
          start: current[0].start,
          end: current[current.length - 1].end,
          durationMins: current.length * 30,
          slots: current,
        });
        current = [];
      }
    }
  }
  if (current.length > 0) {
    blocks.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      durationMins: current.length * 30,
      slots: current,
    });
  }
  return blocks;
}

function getMinutesFromSlotTime(datetime: string): number {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

export default function RoomDetail({ room, initialDate }: { room: Room; initialDate?: string }) {
  const [date, setDate] = useState(initialDate || todayStr());
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();

  const location = LOCATIONS.find((l) => l.id === room.locationId);
  const group = location?.groups.find((g) => g.id === room.groupId);

  const fetchSlots = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const end = tomorrowStr(dateStr);
      const res = await fetch(
        `/api/availability?start=${dateStr}&end=${end}&lid=${room.locationId}&gid=${room.groupId}`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const roomSlots = (data.slots || []).filter(
        (s: SlotData) => s.itemId === room.id
      );
      setSlots(roomSlots.sort((a: SlotData, b: SlotData) => a.start.localeCompare(b.start)));
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    fetchSlots(date);
  }, [date, fetchSlots]);

  const today = todayStr();

  const slotInfos: SlotInfo[] = slots.map((s) => ({
    slot: s,
    available: isSlotAvailable(s),
    past: !isSlotFuture(s, today),
  }));

  const futureSlots = slotInfos.filter((s) => !s.past);
  const bookableSlots = futureSlots.filter((s) => s.available);
  const takenSlots = futureSlots.filter((s) => !s.available);
  const blocks = buildBlocks(slotInfos);
  const isOpen = bookableSlots.length > 0;

  // Timeline data
  const timelineStart = slots.length > 0 ? getMinutesFromSlotTime(slots[0].start) : 0;
  const timelineEnd = slots.length > 0 ? getMinutesFromSlotTime(slots[slots.length - 1].end) : 0;
  const timelineSpan = timelineEnd - timelineStart;

  const hourMarkers: number[] = [];
  if (timelineSpan > 0) {
    const firstHour = Math.ceil(timelineStart / 60) * 60;
    for (let m = firstHour; m <= timelineEnd; m += 120) {
      hourMarkers.push(m);
    }
  }

  const canGoPrev = date > today;
  const goPrev = () => {
    if (!canGoPrev) return;
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split("T")[0]);
  };
  const goNext = () => setDate(tomorrowStr(date));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — matches dashboard header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 dark:bg-surface-dark/80 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.074 2.356M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.356" />
                  </svg>
                </div>
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground leading-tight truncate">{room.name}</h1>
                <p className="text-xs text-muted">{location?.name} · {group?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/planner"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-slate-900 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                title="Study Planner"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="hidden sm:inline">Planner</span>
              </Link>
              <button
                onClick={() => toggleFavorite(room.id)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isFavorite(room.id)
                    ? "text-accent hover:text-accent-hover"
                    : "text-slate-300 dark:text-slate-600 hover:text-accent/60"
                }`}
                aria-label={isFavorite(room.id) ? "Remove from favorites" : "Add to favorites"}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavorite(room.id) ? "currentColor" : "none"} strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
              {!loading && slots.length > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOpen
                    ? "bg-available/10 text-available border border-available/20"
                    : "bg-booked/10 text-booked border border-booked/20"
                }`}>
                  {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-available animate-pulse" />}
                  {isOpen ? "Open" : "Fully Booked"}
                </span>
              )}
              {!loading && slots.length === 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-muted border border-slate-200 dark:border-slate-700">
                  {date > today ? "Not Open Yet" : "No Data"}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Room details — pill-style info row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card dark:bg-card-dark border border-slate-200 dark:border-slate-700 text-xs font-medium text-foreground">
            <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {room.capacity} {room.capacity === 1 ? "person" : "people"}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-card dark:bg-card-dark border border-slate-200 dark:border-slate-700 text-xs font-medium text-foreground">
            {room.floor} Floor
          </span>
          {room.features.map((f) => (
            <span key={f} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium border border-accent/20">
              {f}
            </span>
          ))}
          <a
            href={bookingUrl(room.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-card dark:bg-card-dark border border-slate-200 dark:border-slate-700 text-xs font-medium text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            View on UCSC
          </a>
        </div>

        {/* Date nav — same pattern as dashboard */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors ${
              canGoPrev
                ? "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                : "opacity-30 cursor-not-allowed"
            }`}
            aria-label="Previous day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-center min-w-[200px]">
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              min={today}
              onChange={(e) => {
                if (e.target.value >= today) setDate(e.target.value);
              }}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker()}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              {formatDateDisplay(date)}
            </button>
            <p className="text-[11px] text-muted">click to change</p>
          </div>
          <button
            onClick={goNext}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Next day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-light transition-colors cursor-pointer"
            >
              Today
            </button>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-3" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-48" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && slots.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-8 text-center space-y-2">
            {date > today ? (
              <>
                <svg className="w-8 h-8 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">Not yet open for booking</p>
                <p className="text-xs text-muted">
                  This date is too far ahead. The library typically opens bookings 1–2 weeks in advance.
                </p>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">No availability data</p>
                <p className="text-xs text-muted">
                  The library may be closed on this day (weekend or holiday).
                </p>
              </>
            )}
          </div>
        )}

        {/* Main content */}
        {!loading && slots.length > 0 && (
          <>
            {/* Visual timeline card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Day overview</h2>
                <div className="flex items-center gap-3 text-[10px] text-muted">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-available/20 border border-available" />
                    Open
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-booked/15 border border-booked/30" />
                    Taken
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-slate-100 dark:bg-slate-800 opacity-40" />
                    Past
                  </span>
                </div>
              </div>

              {/* Timeline bar */}
              {timelineSpan > 0 && (
                <div>
                  {/* Hour markers */}
                  <div className="relative h-4 mb-1">
                    {hourMarkers.map((m) => {
                      const pct = ((m - timelineStart) / timelineSpan) * 100;
                      const hour = m / 60;
                      const ampm = hour >= 12 ? "p" : "a";
                      const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      return (
                        <span
                          key={m}
                          className="absolute text-[10px] text-muted -translate-x-1/2 tabular-nums"
                          style={{ left: `${Math.min(Math.max(pct, 3), 97)}%` }}
                        >
                          {display}{ampm}
                        </span>
                      );
                    })}
                  </div>

                  {/* Slot segments */}
                  <div className="flex h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {slotInfos.map((si, idx) => {
                      let classes: string;
                      if (si.past) {
                        classes = "bg-slate-100 dark:bg-slate-800 opacity-40";
                      } else if (si.available) {
                        classes = "bg-available/20 border-available hover:bg-available/30";
                      } else {
                        classes = "bg-booked/15 border-booked/30";
                      }
                      const widthPct = (30 / timelineSpan) * 100;
                      return (
                        <div
                          key={si.slot.start}
                          className={`${classes} transition-colors relative group ${idx < slotInfos.length - 1 ? "border-r border-slate-200/40 dark:border-slate-700/40" : ""}`}
                          style={{ width: `${widthPct}%` }}
                          title={`${formatTime(si.slot.start)} – ${formatTime(si.slot.end)}: ${si.past ? "Past" : si.available ? "Available" : "Taken"}`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {formatTimeCompact(si.slot.start)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Availability bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-available transition-all"
                    style={{ width: `${futureSlots.length > 0 ? (bookableSlots.length / futureSlots.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-muted tabular-nums shrink-0">
                  {bookableSlots.length}/{futureSlots.length} open
                </span>
              </div>
            </div>

            {/* Booking section */}
            {blocks.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Available times</h2>
                {blocks.map((block, i) => {
                  const maxSlots = 8; // 4 hours = 8 × 30min slots
                  const capped = block.slots.length > maxSlots;
                  const bookSlots = capped ? block.slots.slice(0, maxSlots) : block.slots;
                  const bookEnd = bookSlots[bookSlots.length - 1].end;

                  return (
                    <div key={i} className="space-y-1">
                      <a
                        href={bookingUrl(room.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-card dark:bg-card-dark border border-available/20 hover:border-available/50 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {formatTime(block.start)} – {formatTime(block.end)}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {formatDuration(block.durationMins)} window
                            {capped && (
                              <span className="text-accent font-medium"> · booking capped at 4 hr</span>
                            )}
                          </div>
                        </div>
                        <span className="px-4 py-1.5 rounded-lg text-xs font-bold bg-available text-white group-hover:bg-available/90 transition-colors">
                          {capped ? "Book 4 hr" : "Book"}
                        </span>
                      </a>
                      {capped && (
                        <p className="text-[11px] text-muted pl-1">
                          This link books {formatTime(block.start)} – {formatTime(bookEnd)}. You can book the rest as a separate reservation.
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Rules banner */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <svg className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Max 4 hours per day. Slots must be consecutive or booked as separate reservations. Sign in with your CruzID to confirm.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-booked/20 bg-booked/5 p-5 text-center">
                <p className="text-sm font-semibold text-foreground">No available times</p>
                <p className="text-xs text-muted mt-1">All slots are booked or have passed. Try another date.</p>
              </div>
            )}

            {/* Full schedule — collapsed by default */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark overflow-hidden">
              <button
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-foreground">
                  All {slotInfos.length} time slots
                </span>
                <svg
                  className={`w-4 h-4 text-muted transition-transform duration-200 ${showFullSchedule ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showFullSchedule && (
                <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                  {slotInfos.map((si) => (
                    <div
                      key={si.slot.start}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        si.past
                          ? "opacity-30"
                          : si.available
                          ? "bg-available/[0.03]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            si.past
                              ? "bg-slate-300 dark:bg-slate-600"
                              : si.available
                              ? "bg-available"
                              : "bg-booked"
                          }`}
                        />
                        <span className="text-sm text-foreground font-medium tabular-nums">
                          {formatTime(si.slot.start)}
                        </span>
                        <span className="text-xs text-muted">– {formatTime(si.slot.end)}</span>
                      </div>
                      <div>
                        {si.past ? (
                          <span className="text-xs text-muted">Past</span>
                        ) : si.available ? (
                          <a
                            href={bookingUrl(room.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-available/10 text-available hover:bg-available/20 transition-colors cursor-pointer"
                          >
                            Book
                          </a>
                        ) : (
                          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-booked/10 text-booked">
                            Taken
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer — matches dashboard */}
      <footer className="border-t border-slate-200 dark:border-slate-700 py-4 mt-auto">
        <div className="max-w-3xl mx-auto px-4 text-xs text-muted text-center">
          Data sourced from{" "}
          <a
            href={homePageUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline cursor-pointer"
          >
            UCSC Library Room Reservations
          </a>
          . Not affiliated with UC Santa Cruz.
        </div>
      </footer>
    </div>
  );
}
