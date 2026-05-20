"use client";

import Link from "next/link";
import { Room } from "../lib/rooms";
import { isSlotAvailable, isSlotBookable, isSlotFuture } from "../lib/slots";
import { SlotData } from "./TimeGrid";

interface QuickStatsProps {
  slots: SlotData[];
  rooms: Room[];
  today: string;
  date: string;
}

function formatTimeShort(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "p" : "a";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  if (m === "00") return `${display}${ampm}`;
  return `${display}:${m}${ampm}`;
}

export default function QuickStats({ slots, rooms, today, date }: QuickStatsProps) {
  const futureSlots = slots.filter((s) => isSlotFuture(s, today));
  const bookableSlots = futureSlots.filter((s) => isSlotBookable(s, today));

  const totalFuture = futureSlots.length;
  const totalBookable = bookableSlots.length;
  const availPct = totalFuture > 0 ? Math.round((totalBookable / totalFuture) * 100) : 0;

  // Per-room stats
  const slotsByRoom = new Map<number, SlotData[]>();
  futureSlots.forEach((s) => {
    const arr = slotsByRoom.get(s.itemId) || [];
    arr.push(s);
    slotsByRoom.set(s.itemId, arr);
  });

  let openRoomCount = 0;
  const totalRooms = slotsByRoom.size;
  slotsByRoom.forEach((roomSlots) => {
    if (roomSlots.some((s) => isSlotAvailable(s))) openRoomCount++;
  });

  // Soonest available slot
  const soonest = bookableSlots.sort((a, b) => a.start.localeCompare(b.start))[0];
  const soonestRoom = soonest ? rooms.find((r) => r.id === soonest.itemId) : null;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Rooms Open */}
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-2xl sm:text-3xl text-available tabular-nums"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {openRoomCount}
          </span>
          <span className="text-sm text-muted">/ {totalRooms}</span>
        </div>
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1">Rooms Open</p>
      </div>

      {/* Availability */}
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5">
        <div className="flex items-baseline gap-1">
          <span
            className="text-2xl sm:text-3xl text-foreground tabular-nums"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {availPct}
          </span>
          <span className="text-sm text-muted">%</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Available</p>
          <div className="flex-1 h-1.5 rounded-full bg-surface dark:bg-surface-dark overflow-hidden max-w-20">
            <div className="h-full rounded-full bg-available transition-all duration-500" style={{ width: `${availPct}%` }} />
          </div>
        </div>
      </div>

      {/* Next Opening */}
      <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5">
        {soonestRoom && soonest ? (
          <Link href={`/room/${soonestRoom.id}?date=${date}`} className="block cursor-pointer group">
            <span
              className="text-2xl sm:text-3xl text-primary-light group-hover:text-primary transition-colors tabular-nums"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatTimeShort(soonest.start)}
            </span>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1 truncate">
              Next opening
            </p>
          </Link>
        ) : (
          <>
            <span className="text-2xl sm:text-3xl text-muted/30" style={{ fontFamily: "var(--font-display)" }}>—</span>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1">No openings</p>
          </>
        )}
      </div>
    </div>
  );
}
