"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Room } from "../lib/rooms";
import { bookingUrl } from "../lib/booking-url";
import { BookingDateModal } from "./BookLink";
import SessionPrompt from "./SessionPrompt";
import { useFavorites } from "../lib/favorites";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";

export interface SlotData {
  start: string;
  end: string;
  itemId: number;
  checksum: string;
  className?: string;
}

interface TimeGridFilter {
  floors: string[];
  minCapacity: number;
  onlyAvailable: boolean;
  onlyFavorites: boolean;
  features: string[];
  search: string;
  sort: "availability" | "name" | "capacity";
}

interface TimeGridProps {
  slots: SlotData[];
  rooms: Room[];
  date: string;
  today: string;
  filter?: TimeGridFilter;
}

function parseTime(datetime: string): { hour: number; min: number } {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  return { hour: parseInt(h), min: parseInt(m) };
}

function formatTimeShort(datetime: string): string {
  const { hour, min } = parseTime(datetime);
  const ampm = hour >= 12 ? "pm" : "am";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${min.toString().padStart(2, "0")} ${ampm}`;
}

function formatTimeFull(datetime: string): string {
  const { hour, min } = parseTime(datetime);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${min.toString().padStart(2, "0")} ${ampm}`;
}

function getTimeSlots(slots: SlotData[]): string[] {
  const times = new Set<string>();
  slots.forEach((s) => times.add(s.start));
  return Array.from(times).sort();
}

function getNowPosition(timeSlots: string[], today: string, date: string): number | null {
  if (date !== today || timeSlots.length === 0) return null;
  const now = new Date();
  const first = new Date(timeSlots[0].replace(" ", "T"));
  const lastSlotEnd = new Date(timeSlots[timeSlots.length - 1].replace(" ", "T"));
  lastSlotEnd.setMinutes(lastSlotEnd.getMinutes() + 30);
  if (now < first || now > lastSlotEnd) return null;
  const totalMs = lastSlotEnd.getTime() - first.getTime();
  return (now.getTime() - first.getTime()) / totalMs;
}

type SlotState = "available" | "booked" | "past";

interface ProcessedSlot {
  time: string;
  state: SlotState;
  slot: SlotData | undefined;
}

export default function TimeGrid({ slots, rooms, date, today, filter }: TimeGridProps) {
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);
  const [modalHref, setModalHref] = useState<string | null>(null);
  const [sessionPromptInfo, setSessionPromptInfo] = useState<{ roomId: number; roomName: string; start: string; end: string } | null>(null);
  const isToday = date === today;
  const { isFavorite } = useFavorites();

  const timeSlots = useMemo(() => getTimeSlots(slots), [slots]);
  const nowPos = useMemo(() => getNowPosition(timeSlots, today, date), [timeSlots, today, date]);

  const slotMap = useMemo(() => {
    const m = new Map<string, SlotData>();
    slots.forEach((s) => m.set(`${s.itemId}-${s.start}`, s));
    return m;
  }, [slots]);

  const roomData = useMemo(() => {
    let filtered = rooms;
    if (filter) {
      if (filter.floors.length > 0) filtered = filtered.filter((r) => filter.floors.includes(r.floor));
      if (filter.minCapacity > 0) filtered = filtered.filter((r) => r.capacity >= filter.minCapacity);
      if (filter.features.length > 0) filtered = filtered.filter((r) => filter.features.every((f) => r.features.includes(f)));
      if (filter.search) { const q = filter.search.toLowerCase(); filtered = filtered.filter((r) => r.name.toLowerCase().includes(q)); }
      if (filter.onlyFavorites) filtered = filtered.filter((r) => isFavorite(r.id));
    }

    const data = filtered.map((room) => {
      const processed: ProcessedSlot[] = timeSlots.map((time) => {
        const slot = slotMap.get(`${room.id}-${time}`);
        let state: SlotState = "booked";
        if (slot) {
          const past = !isSlotFuture(slot, today);
          if (past) state = "past";
          else if (isSlotAvailable(slot)) state = "available";
          else state = "booked";
        }
        return { time, state, slot };
      });

      const bookable = processed.filter((s) => s.state === "available").length;
      const future = processed.filter((s) => s.state !== "past").length;

      return { room, slots: processed, bookable, future };
    });

    if (filter?.onlyAvailable) data.splice(0, data.length, ...data.filter((r) => r.bookable > 0));

    // Sort
    const sortMode = filter?.sort ?? "availability";
    if (sortMode === "availability") data.sort((a, b) => b.bookable - a.bookable);
    else if (sortMode === "name") data.sort((a, b) => a.room.name.localeCompare(b.room.name));
    else if (sortMode === "capacity") data.sort((a, b) => b.room.capacity - a.room.capacity);

    return data;
  }, [rooms, timeSlots, slotMap, today, filter]);

  const hourMarkers = useMemo(() => {
    const markers: { idx: number; label: string }[] = [];
    timeSlots.forEach((time, idx) => {
      if (time.split(" ")[1].split(":")[1] === "00") {
        markers.push({ idx, label: formatTimeShort(time) });
      }
    });
    return markers;
  }, [timeSlots]);

  if (timeSlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <p>No availability data for this date.</p>
      </div>
    );
  }

  if (roomData.length === 0) {
    return (
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-12 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">No rooms match your filters</p>
        <p className="text-sm text-muted">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  const hoveredInfo = hoveredRoom !== null && hoveredSlotIdx !== null
    ? (() => {
        const rd = roomData.find((r) => r.room.id === hoveredRoom);
        if (!rd) return null;
        const ps = rd.slots[hoveredSlotIdx];
        if (!ps) return null;
        return { room: rd.room, ...ps };
      })()
    : null;

  return (
    <div>
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden shadow-sm">
        {/* Hover detail strip */}
        <div className="h-11 border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark flex items-center justify-center px-4 overflow-hidden">
          {hoveredInfo ? (
            <div className="flex items-center gap-3 animate-in fade-in duration-100">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                hoveredInfo.state === "available" ? "bg-available" :
                hoveredInfo.state === "booked" ? "bg-booked" : "bg-muted/40"
              }`} />
              <span className="text-sm font-semibold text-foreground truncate">{hoveredInfo.room.name}</span>
              {hoveredInfo.slot && (
                <span className="text-sm text-muted hidden sm:inline tabular-nums">
                  {formatTimeFull(hoveredInfo.slot.start)} – {formatTimeFull(hoveredInfo.slot.end)}
                </span>
              )}
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                hoveredInfo.state === "available"
                  ? "bg-available/10 text-available"
                  : hoveredInfo.state === "booked"
                    ? "bg-booked/10 text-booked"
                    : "bg-surface dark:bg-surface-dark text-muted border border-border dark:border-border-dark"
              }`}>
                {hoveredInfo.state === "available" ? "Click to book" : hoveredInfo.state === "booked" ? "Booked" : "Past"}
              </span>
            </div>
          ) : (
            <>
              <span className="text-[11px] text-muted/50 hidden sm:inline">Hover over a time slot for details</span>
              <span className="text-[11px] text-muted/50 sm:hidden">Tap a time slot for details</span>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          {/* Time axis header */}
          <div className="flex border-b border-border dark:border-border-dark">
            <div className="shrink-0 w-32 sm:w-48 min-w-[128px] sm:min-w-[192px] px-3 sm:px-4 py-2.5 bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark flex items-end">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Room</span>
            </div>
            <div className="flex-1 flex items-end relative min-w-0 pl-6 pr-3">
              {timeSlots.map((time, idx) => {
                const isHour = time.split(" ")[1].split(":")[1] === "00";
                return (
                  <div
                    key={time}
                    className="flex-1 min-w-[28px] relative"
                  >
                    {isHour ? (
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] font-semibold text-muted tabular-nums pb-1 -translate-x-1/2">
                          {formatTimeShort(time)}
                        </span>
                        <div className="w-px h-2 bg-muted/30" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] pb-1 invisible">.</span>
                        <div className="w-px h-1 bg-border dark:bg-border-dark" />
                      </div>
                    )}
                  </div>
                );
              })}
              {nowPos !== null && (
                <div
                  className="absolute bottom-0 w-0.5 h-full bg-accent/60 z-10"
                  style={{ left: `${nowPos * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Room rows */}
          {roomData.map(({ room, slots: roomSlots, bookable, future }, rowIdx) => (
            <div
              key={room.id}
              className={`flex group/row transition-colors ${
                rowIdx < roomData.length - 1 ? "border-b border-border/50 dark:border-border-dark/50" : ""
              } ${hoveredRoom === room.id ? "bg-surface/60 dark:bg-surface-dark/40" : "hover:bg-surface/30 dark:hover:bg-surface-dark/20"}`}
            >
              {/* Room label */}
              <Link
                href={`/room/${room.id}?date=${date}`}
                className="shrink-0 w-32 sm:w-48 min-w-[128px] sm:min-w-[192px] px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border dark:border-border-dark hover:bg-surface/80 dark:hover:bg-surface-dark/60 transition-colors cursor-pointer flex flex-col justify-center"
              >
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate leading-tight">{room.name}</p>
                  {future > 0 && (
                    <span className={`text-[10px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-full ${
                      bookable > 0
                        ? "bg-available/10 text-available"
                        : "bg-booked/8 text-booked"
                    }`}>
                      {bookable}/{future}
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted mt-0.5 truncate">
                  {room.floor} · {room.capacity} seats
                </p>
              </Link>

              {/* Slot cells */}
              <div className="flex-1 flex items-stretch relative py-1 min-w-0 pl-6 pr-3">
                {roomSlots.map(({ time, state, slot }, idx) => {
                  const prev = idx > 0 ? roomSlots[idx - 1] : null;
                  const next = idx < roomSlots.length - 1 ? roomSlots[idx + 1] : null;
                  const prevState = prev?.state ?? null;
                  const nextState = next?.state ?? null;

                  const isStart = state !== prevState;
                  const isEnd = state !== nextState;

                  let rounded = "";
                  if (isStart && isEnd) rounded = "rounded-lg";
                  else if (isStart) rounded = "rounded-l-lg";
                  else if (isEnd) rounded = "rounded-r-lg";

                  const isHovered = hoveredRoom === room.id && hoveredSlotIdx === idx;
                  const isRowHovered = hoveredRoom === room.id;

                  let bg: string;
                  if (state === "past") {
                    bg = "bg-surface/60 dark:bg-surface-dark/30";
                  } else if (state === "available") {
                    bg = isHovered
                      ? "bg-available/35 ring-2 ring-available/40 ring-inset"
                      : isRowHovered
                        ? "bg-available/22"
                        : "bg-available/12";
                  } else {
                    bg = isHovered
                      ? "bg-booked/20 ring-2 ring-booked/30 ring-inset"
                      : isRowHovered
                        ? "bg-booked/12"
                        : "bg-booked/6";
                  }

                  const cellProps = {
                    className: `flex-1 min-w-[28px] h-9 ${bg} ${rounded} transition-all duration-100 relative ${
                      state === "available" ? "cursor-pointer" : ""
                    }`,
                    onMouseEnter: () => { setHoveredRoom(room.id); setHoveredSlotIdx(idx); },
                    onMouseLeave: () => { setHoveredRoom(null); setHoveredSlotIdx(null); },
                  };

                  if (state === "available" && slot) {
                    const href = bookingUrl(room.id, { start: slot.start, end: slot.end, roomName: room.name });
                    return (
                      <a
                        key={time}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          setSessionPromptInfo({ roomId: room.id, roomName: room.name, start: slot.start, end: slot.end });
                          if (!isToday) { e.preventDefault(); setModalHref(href); }
                        }}
                        {...cellProps}
                      />
                    );
                  }

                  return <div key={time} {...cellProps} />;
                })}

                {nowPos !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
                    style={{ left: `${nowPos * 100}%` }}
                  >
                    <div className="absolute -top-0.5 -left-[3px] w-2 h-2 rounded-full bg-accent" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend footer */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 border-t border-border/50 dark:border-border-dark/50 bg-surface/30 dark:bg-surface-dark/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-md bg-available/12 border border-available/25" />
            <span className="text-[10px] text-muted font-medium">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-md bg-booked/8 border border-booked/15" />
            <span className="text-[10px] text-muted font-medium">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-md bg-surface dark:bg-surface-dark border border-border dark:border-border-dark" />
            <span className="text-[10px] text-muted font-medium">Past</span>
          </div>
          {nowPos !== null && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-accent rounded-full" />
              <span className="text-[10px] text-muted font-medium">Now</span>
            </div>
          )}
        </div>
      </div>

      <BookingDateModal
        open={modalHref !== null}
        onClose={() => setModalHref(null)}
        href={modalHref ?? ""}
        slotDate={date}
      />

      {sessionPromptInfo && (
        <SessionPrompt
          open={sessionPromptInfo !== null && modalHref === null}
          onClose={() => setSessionPromptInfo(null)}
          roomId={sessionPromptInfo.roomId}
          roomName={sessionPromptInfo.roomName}
          date={date}
          slotStart={sessionPromptInfo.start}
          slotEnd={sessionPromptInfo.end}
        />
      )}
    </div>
  );
}
