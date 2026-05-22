"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Room } from "../lib/rooms";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { bookingUrl } from "../lib/booking-url";
import { addBookingRecord } from "../lib/booking-history";
import { useFavorites } from "../lib/favorites";
import { BookingDateModal } from "./BookLink";
import SessionPrompt from "./SessionPrompt";
import Collapsible from "./ui/collapsible";
import { SlotData } from "./TimeGrid";

interface OpenNowProps {
  slots: SlotData[];
  rooms: Room[];
  date: string;
  today: string;
}

function formatTime(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

interface OpenRoom {
  room: Room;
  firstSlot: SlotData;
  lastSlot: SlotData;
  freeMins: number;
}

function getMinutes(datetime: string): number {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs > 0 && m > 0) return `${hrs}h ${m}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${m}m`;
}

function findOpenRooms(slots: SlotData[], rooms: Room[], today: string): OpenRoom[] {
  const slotsByRoom = new Map<number, SlotData[]>();
  for (const s of slots) {
    const arr = slotsByRoom.get(s.itemId) || [];
    arr.push(s);
    slotsByRoom.set(s.itemId, arr);
  }

  const results: OpenRoom[] = [];

  slotsByRoom.forEach((roomSlots, roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const sorted = roomSlots
      .filter((s) => isSlotFuture(s, today) && isSlotAvailable(s))
      .sort((a, b) => a.start.localeCompare(b.start));

    if (sorted.length === 0) return;

    // Find the longest consecutive block starting from the first available slot
    const block: SlotData[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (getMinutes(sorted[i].start) === getMinutes(block[block.length - 1].end)) {
        block.push(sorted[i]);
      } else {
        break;
      }
    }

    results.push({
      room,
      firstSlot: block[0],
      lastSlot: block[block.length - 1],
      freeMins: getMinutes(block[block.length - 1].end) - getMinutes(block[0].start),
    });
  });

  return results;
}

export default function OpenNow({ slots, rooms, date, today }: OpenNowProps) {
  const { isFavorite } = useFavorites();
  const isToday = date === today;

  const [expanded, setExpanded] = useState(false);
  const [modalHref, setModalHref] = useState<string | null>(null);
  const [sessionPromptRoom, setSessionPromptRoom] = useState<{ roomId: number; roomName: string; start: string; end: string } | null>(null);

  const openRooms = useMemo(() => {
    const results = findOpenRooms(slots, rooms, today);
    results.sort((a, b) => b.freeMins - a.freeMins);
    return results;
  }, [slots, rooms, today]);

  if (openRooms.length === 0) {
    return (
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark px-5 py-5 flex items-center gap-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-booked/60" />
        </span>
        <p className="text-xs text-muted">No rooms available {isToday ? "right now" : "on this date"}. Check back soon or try a different date.</p>
      </div>
    );
  }
  const top = openRooms.slice(0, 3);
  const totalOpen = openRooms.length;

  return (
    <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
      {/* Header — clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-surface/40 dark:hover:bg-surface-dark/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-available opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-available" />
          </span>
          <h2
            className="text-sm sm:text-base font-normal text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {isToday ? "Book Now" : "Available Rooms"}
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-muted tabular-nums">
            {totalOpen} room{totalOpen !== 1 ? "s" : ""} open
          </span>
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Room rows — collapsible */}
      <Collapsible open={expanded}>
        <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
          {top.map((nr) => {
            const isFav = isFavorite(nr.room.id);
            const url = bookingUrl(nr.room.id, {
              start: nr.firstSlot.start,
              end: nr.lastSlot.end,
              roomName: nr.room.name,
            });

            return (
              <div key={nr.room.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-3">
                {/* Room info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/room/${nr.room.id}?date=${date}`}
                      className="text-[13px] font-semibold text-foreground hover:text-primary dark:hover:text-secondary transition-colors cursor-pointer truncate"
                    >
                      {nr.room.name}
                    </Link>
                    {isFav && (
                      <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted">
                      {nr.room.capacity} seats · {nr.room.floor}
                    </span>
                  </div>
                </div>

                {/* Time window + duration */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-muted tabular-nums block">
                      {formatTime(nr.firstSlot.start)} – {formatTime(nr.lastSlot.end)}
                    </span>
                    <span className="text-[10px] font-bold text-available tabular-nums">
                      {formatDuration(nr.freeMins)} free
                    </span>
                  </div>

                  {/* Book button */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      addBookingRecord(
                        nr.room.id, nr.room.name, date,
                        nr.firstSlot.start, nr.lastSlot.end,
                        nr.room.locationId, nr.room.groupId
                      );
                      setSessionPromptRoom({ roomId: nr.room.id, roomName: nr.room.name, start: nr.firstSlot.start, end: nr.lastSlot.end });
                      if (!isToday) {
                        e.preventDefault();
                        setModalHref(url);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-available text-white hover:bg-available/85 transition-colors cursor-pointer"
                  >
                    Book
                  </a>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          {totalOpen > 3 && (
            <div className="px-5 py-2.5 border-t border-border dark:border-border-dark bg-surface/30 dark:bg-surface-dark/30 text-center">
              <span className="text-[11px] text-muted">
                +{totalOpen - 3} more room{totalOpen - 3 !== 1 ? "s" : ""} available
              </span>
            </div>
          )}
        </div>
      </Collapsible>

      <BookingDateModal
        open={modalHref !== null}
        onClose={() => setModalHref(null)}
        href={modalHref ?? ""}
        slotDate={date}
      />

      {sessionPromptRoom && (
        <SessionPrompt
          open={sessionPromptRoom !== null && modalHref === null}
          onClose={() => setSessionPromptRoom(null)}
          roomId={sessionPromptRoom.roomId}
          roomName={sessionPromptRoom.roomName}
          date={date}
          slotStart={sessionPromptRoom.start}
          slotEnd={sessionPromptRoom.end}
        />
      )}
    </div>
  );
}
