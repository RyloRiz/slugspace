"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, LOCATIONS } from "../../lib/rooms";
import { bookingUrl, homePageUrl } from "../../lib/booking-url";
import { useFavorites } from "../../lib/favorites";
import { isSlotAvailable, isSlotFuture } from "../../lib/slots";
import { SlotData } from "../../components/TimeGrid";

const LIBRARY_IMAGES: Record<number, { hero: string; alt: string }> = {
  16578: { hero: "/libraries/se-hero.png", alt: "Science & Engineering Library" },
  16577: { hero: "/libraries/mchenry-hero.png", alt: "McHenry Library" },
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
  const libraryImg = LIBRARY_IMAGES[room.locationId] || LIBRARY_IMAGES[16578];

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
  const isToday = date === today;

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

  const availPct = futureSlots.length > 0 ? Math.round((bookableSlots.length / futureSlots.length) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 shrink-0 group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.074 2.356M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.356" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-normal text-white/90 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  Room Booker
                </p>
                <p className="text-[9px] text-white/40 tracking-widest uppercase">UC Santa Cruz</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/planner"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="hidden sm:inline">Planner</span>
              </Link>
              <button
                onClick={() => toggleFavorite(room.id)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isFavorite(room.id) ? "text-accent bg-accent/15" : "text-white/40 hover:text-accent/60 hover:bg-white/10"
                }`}
                aria-label={isFavorite(room.id) ? "Remove from favorites" : "Add to favorites"}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavorite(room.id) ? "currentColor" : "none"} strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div className="relative h-56 sm:h-64 overflow-hidden">
        <Image
          src={libraryImg.hero}
          alt={libraryImg.alt}
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-primary/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl w-full mx-auto px-5 pb-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-3">
              <Link href="/" className="hover:text-white/80 transition-colors cursor-pointer">{location?.shortName}</Link>
              <span>/</span>
              <span>{group?.name}</span>
            </div>

            {/* Room name + status */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1
                  className="text-3xl sm:text-4xl text-white leading-none drop-shadow-sm"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {room.name}
                </h1>
                <div className="flex items-center gap-3 mt-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm text-xs font-medium text-white/80">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {room.capacity} {room.capacity === 1 ? "person" : "seats"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm text-xs font-medium text-white/80">
                    {room.floor} floor
                  </span>
                  {room.features.map((f) => (
                    <span key={f} className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/20 backdrop-blur-sm text-xs font-medium text-accent">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status badge */}
              {!loading && slots.length > 0 && (
                <div className={`shrink-0 px-4 py-2 rounded-xl backdrop-blur-sm text-sm font-bold ${
                  isOpen
                    ? "bg-available/20 text-available border border-available/30"
                    : "bg-booked/20 text-booked border border-booked/30"
                }`}>
                  {isOpen ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-available animate-pulse" />
                      {bookableSlots.length} open
                    </span>
                  ) : "Fully booked"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-8 space-y-6">
        {/* ── Date Navigation ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={!canGoPrev}
              className={`p-2.5 rounded-xl transition-all ${
                canGoPrev
                  ? "hover:bg-surface dark:hover:bg-surface-dark cursor-pointer text-foreground border border-border dark:border-border-dark"
                  : "opacity-20 cursor-not-allowed"
              }`}
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
                className="cursor-pointer group"
              >
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-0.5">
                  {isToday ? "Today" : "Viewing"}
                </p>
                <p
                  className="text-lg font-semibold text-foreground group-hover:text-primary dark:group-hover:text-secondary transition-colors"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatDateDisplay(date)}
                </p>
              </button>
            </div>
            <button
              onClick={goNext}
              className="p-2.5 rounded-xl hover:bg-surface dark:hover:bg-surface-dark border border-border dark:border-border-dark transition-all cursor-pointer text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isToday && (
              <button
                onClick={() => setDate(today)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-card bg-primary hover:bg-primary/90 shadow-sm transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Today
              </button>
            )}
            <a
              href={bookingUrl(room.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-primary dark:text-secondary bg-primary/5 hover:bg-primary/10 border border-primary/15 dark:border-secondary/15 hover:border-primary/25 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View on UCSC
            </a>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5">
              <div className="h-3 bg-surface dark:bg-surface-dark rounded w-32 mb-4" />
              <div className="h-10 bg-surface dark:bg-surface-dark rounded-xl w-full mb-3" />
              <div className="h-2 bg-surface dark:bg-surface-dark rounded w-48" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5">
                <div className="h-5 bg-surface dark:bg-surface-dark rounded w-48 mb-2" />
                <div className="h-3 bg-surface dark:bg-surface-dark rounded w-24" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && slots.length === 0 && (
          <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-10 text-center space-y-3">
            {date > today ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Not yet open for booking</p>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  This date is too far ahead. The library typically opens bookings 1-2 weeks in advance.
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-surface dark:bg-surface-dark flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>No availability data</p>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  The library may be closed on this day (weekend or holiday).
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Main content ── */}
        {!loading && slots.length > 0 && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                  {bookableSlots.length}
                </p>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">Available</p>
              </div>
              <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                  {takenSlots.length}
                </p>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">Booked</p>
              </div>
              <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 text-center">
                <p className={`text-2xl font-bold tabular-nums ${availPct > 50 ? "text-available" : availPct > 0 ? "text-accent" : "text-booked"}`} style={{ fontFamily: "var(--font-display)" }}>
                  {availPct}%
                </p>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">Open</p>
              </div>
            </div>

            {/* Timeline card */}
            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Day Overview</h2>
                <div className="flex items-center gap-4 text-[10px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-available/20 border border-available/40" />
                    Open
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-booked/15 border border-booked/25" />
                    Taken
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-surface dark:bg-surface-dark border border-border dark:border-border-dark" />
                    Past
                  </span>
                </div>
              </div>

              {timelineSpan > 0 && (
                <div>
                  <div className="relative h-4 mb-1.5">
                    {hourMarkers.map((m) => {
                      const pct = ((m - timelineStart) / timelineSpan) * 100;
                      const hour = m / 60;
                      const ampm = hour >= 12 ? "pm" : "am";
                      const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      return (
                        <span
                          key={m}
                          className="absolute text-[10px] text-muted font-medium -translate-x-1/2 tabular-nums"
                          style={{ left: `${Math.min(Math.max(pct, 3), 97)}%` }}
                        >
                          {display} {ampm}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex h-10 rounded-xl overflow-hidden border border-border dark:border-border-dark">
                    {slotInfos.map((si, idx) => {
                      let classes: string;
                      if (si.past) {
                        classes = "bg-surface dark:bg-surface-dark opacity-40";
                      } else if (si.available) {
                        classes = "bg-available/15 hover:bg-available/25";
                      } else {
                        classes = "bg-booked/10";
                      }
                      const widthPct = (30 / timelineSpan) * 100;
                      return (
                        <div
                          key={si.slot.start}
                          className={`${classes} transition-colors relative group ${idx < slotInfos.length - 1 ? "border-r border-border/30 dark:border-border-dark/30" : ""}`}
                          style={{ width: `${widthPct}%` }}
                          title={`${formatTime(si.slot.start)} – ${formatTime(si.slot.end)}: ${si.past ? "Past" : si.available ? "Available" : "Taken"}`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-primary text-white text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                            {formatTimeCompact(si.slot.start)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Availability bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
                  <div
                    className="h-full rounded-full bg-available transition-all"
                    style={{ width: `${availPct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted tabular-nums shrink-0">
                  {bookableSlots.length}/{futureSlots.length} open
                </span>
              </div>
            </div>

            {/* Booking section */}
            {blocks.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Available Times</h2>
                {blocks.map((block, i) => {
                  const maxSlots = 8;
                  const capped = block.slots.length > maxSlots;
                  const bookSlots = capped ? block.slots.slice(0, maxSlots) : block.slots;
                  const bookEnd = bookSlots[bookSlots.length - 1].end;

                  return (
                    <div key={i} className="space-y-1.5">
                      <a
                        href={bookingUrl(room.id, { start: block.start, end: bookEnd, roomName: room.name })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-5 py-4 rounded-2xl bg-card dark:bg-card-dark border border-available/15 hover:border-available/40 hover:shadow-lg hover:shadow-available/5 transition-all cursor-pointer group"
                      >
                        <div>
                          <div className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                            {formatTime(block.start)} – {formatTime(block.end)}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {formatDuration(block.durationMins)} window
                            {capped && (
                              <span className="text-accent font-semibold"> · capped at 4 hr</span>
                            )}
                          </div>
                        </div>
                        <span className="px-5 py-2 rounded-xl text-xs font-bold bg-available text-white group-hover:bg-available/90 transition-colors shadow-sm">
                          {capped ? "Book 4 hr" : "Book"}
                        </span>
                      </a>
                      {capped && (
                        <p className="text-[11px] text-muted pl-2">
                          Books {formatTime(block.start)} – {formatTime(bookEnd)}. Book remaining time as a separate reservation.
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Rules */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15">
                  <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Max 4 hours per day. Slots must be consecutive or booked as separate reservations. Sign in with your CruzID to confirm.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-booked/15 bg-booked/3 p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-booked/10 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-booked" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>No available times</p>
                <p className="text-xs text-muted">All slots are booked or have passed. Try another date.</p>
              </div>
            )}

            {/* Full schedule */}
            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
              <button
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface/50 dark:hover:bg-surface-dark/30 transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold text-foreground">
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
                <div className="border-t border-border dark:border-border-dark divide-y divide-border/50 dark:divide-border-dark/50">
                  {slotInfos.map((si) => (
                    <div
                      key={si.slot.start}
                      className={`flex items-center justify-between px-5 py-3 ${
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
                              ? "bg-muted/40"
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
                            href={bookingUrl(room.id, { start: si.slot.start, end: si.slot.end, roomName: room.name })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-available/10 text-available hover:bg-available/20 transition-colors cursor-pointer"
                          >
                            Book
                          </a>
                        ) : (
                          <span className="px-4 py-1.5 rounded-xl text-xs font-medium bg-booked/8 text-booked">
                            Taken
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border dark:border-border-dark py-5 mt-auto">
        <div className="max-w-4xl mx-auto px-5 text-xs text-muted/60 text-center">
          Data sourced from{" "}
          <a
            href={homePageUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary dark:text-secondary hover:underline cursor-pointer"
          >
            UCSC Library Room Reservations
          </a>
          . Not affiliated with UC Santa Cruz.
        </div>
      </footer>
    </div>
  );
}
