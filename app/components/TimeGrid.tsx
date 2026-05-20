"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Room } from "../lib/rooms";
import { bookingUrl } from "../lib/booking-url";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";

export interface SlotData {
  start: string;
  end: string;
  itemId: number;
  checksum: string;
  className?: string;
}

interface TimeGridProps {
  slots: SlotData[];
  rooms: Room[];
  date: string;
  today: string;
}

function parseTime(datetime: string): { hour: number; min: number } {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  return { hour: parseInt(h), min: parseInt(m) };
}

function formatTimeShort(datetime: string): string {
  const { hour, min } = parseTime(datetime);
  const ampm = hour >= 12 ? "p" : "a";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  if (min === 0) return `${display}${ampm}`;
  return `${display}:${min.toString().padStart(2, "0")}${ampm}`;
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

/** Get the fractional position of "now" within the time range, or null if outside. */
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

export default function TimeGrid({ slots, rooms, date, today }: TimeGridProps) {
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);

  const timeSlots = useMemo(() => getTimeSlots(slots), [slots]);
  const nowPos = useMemo(() => getNowPosition(timeSlots, today, date), [timeSlots, today, date]);

  const slotMap = useMemo(() => {
    const m = new Map<string, SlotData>();
    slots.forEach((s) => m.set(`${s.itemId}-${s.start}`, s));
    return m;
  }, [slots]);

  const roomData = useMemo(() => {
    return rooms.map((room) => {
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
    }).sort((a, b) => b.bookable - a.bookable);
  }, [rooms, timeSlots, slotMap, today]);

  // Hour markers for the header
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

  // Hovered cell info for the floating detail panel
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark overflow-hidden">
        <div className="overflow-x-auto">
          {/* Time axis header */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <div className="shrink-0 w-48 min-w-[192px] px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex items-end">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Room</span>
            </div>
            <div className="flex-1 flex items-end relative min-w-0">
              {timeSlots.map((time, idx) => {
                const isHour = time.split(" ")[1].split(":")[1] === "00";
                return (
                  <div
                    key={time}
                    className="flex-1 min-w-[18px] relative"
                  >
                    {isHour ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-medium text-muted tabular-nums pb-1">
                          {formatTimeShort(time)}
                        </span>
                        <div className="w-px h-1.5 bg-slate-300 dark:bg-slate-600" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] pb-1 invisible">.</span>
                        <div className="w-px h-0.5 bg-slate-200 dark:bg-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Now indicator on header */}
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
                rowIdx < roomData.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""
              } ${hoveredRoom === room.id ? "bg-slate-50/80 dark:bg-slate-800/40" : "hover:bg-slate-50/40 dark:hover:bg-slate-800/20"}`}
            >
              {/* Room label */}
              <Link
                href={`/room/${room.id}?date=${date}`}
                className="shrink-0 w-48 min-w-[192px] px-4 py-3 border-r border-slate-200 dark:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col justify-center"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{room.name}</p>
                  {future > 0 && (
                    <span className={`text-[10px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-full ${
                      bookable > 0
                        ? "bg-available/15 text-available"
                        : "bg-booked/10 text-booked"
                    }`}>
                      {bookable}/{future}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  {room.floor} · {room.capacity} seats
                </p>
              </Link>

              {/* Slot cells */}
              <div className="flex-1 flex items-stretch relative py-1 px-0.5 min-w-0">
                {roomSlots.map(({ time, state, slot }, idx) => {
                  const prev = idx > 0 ? roomSlots[idx - 1] : null;
                  const next = idx < roomSlots.length - 1 ? roomSlots[idx + 1] : null;
                  const prevState = prev?.state ?? null;
                  const nextState = next?.state ?? null;

                  const isStart = state !== prevState;
                  const isEnd = state !== nextState;

                  let rounded = "";
                  if (isStart && isEnd) rounded = "rounded-md";
                  else if (isStart) rounded = "rounded-l-md";
                  else if (isEnd) rounded = "rounded-r-md";

                  const isHovered = hoveredRoom === room.id && hoveredSlotIdx === idx;
                  const isRowHovered = hoveredRoom === room.id;

                  let bg: string;
                  if (state === "past") {
                    bg = "bg-slate-100/80 dark:bg-slate-800/40";
                  } else if (state === "available") {
                    bg = isHovered
                      ? "bg-available/40 ring-2 ring-available/50 ring-inset"
                      : isRowHovered
                        ? "bg-available/25"
                        : "bg-available/15";
                  } else {
                    bg = isHovered
                      ? "bg-booked/25 ring-2 ring-booked/40 ring-inset"
                      : isRowHovered
                        ? "bg-booked/15"
                        : "bg-booked/8";
                  }

                  // Gap between different state blocks
                  const gap = isStart && idx > 0 ? "ml-[2px]" : "";

                  const cellProps = {
                    className: `flex-1 min-w-[18px] h-9 ${bg} ${rounded} transition-all duration-100 relative ${
                      state === "available" ? "cursor-pointer" : ""
                    } ${gap}`,
                    onMouseEnter: () => { setHoveredRoom(room.id); setHoveredSlotIdx(idx); },
                    onMouseLeave: () => { setHoveredRoom(null); setHoveredSlotIdx(null); },
                  };

                  if (state === "available" && slot) {
                    return (
                      <a
                        key={time}
                        href={bookingUrl(room.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...cellProps}
                      />
                    );
                  }

                  return <div key={time} {...cellProps} />;
                })}

                {/* Now indicator line */}
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

        {/* Hover detail strip — fixed height, no layout shift */}
        <div className="h-10 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center px-4 overflow-hidden">
          {hoveredInfo ? (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-100">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                hoveredInfo.state === "available" ? "bg-available" :
                hoveredInfo.state === "booked" ? "bg-booked" : "bg-slate-400"
              }`} />
              <span className="text-sm font-semibold text-foreground truncate">{hoveredInfo.room.name}</span>
              {hoveredInfo.slot && (
                <span className="text-sm text-muted hidden sm:inline">
                  {formatTimeFull(hoveredInfo.slot.start)} – {formatTimeFull(hoveredInfo.slot.end)}
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                hoveredInfo.state === "available"
                  ? "bg-available/15 text-available"
                  : hoveredInfo.state === "booked"
                    ? "bg-booked/15 text-booked"
                    : "bg-slate-200 dark:bg-slate-700 text-muted"
              }`}>
                {hoveredInfo.state === "available" ? "Click to book" : hoveredInfo.state === "booked" ? "Booked" : "Past"}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted">Hover over a time slot for details</span>
          )}
        </div>

        {/* Legend footer */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-available/15 border border-available/30" />
            <span className="text-[10px] text-muted">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-booked/10 border border-booked/20" />
            <span className="text-[10px] text-muted">Booked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
            <span className="text-[10px] text-muted">Past</span>
          </div>
          {nowPos !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-accent rounded-full" />
              <span className="text-[10px] text-muted">Now</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
