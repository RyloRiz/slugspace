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
    <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-available">{openRoomCount}</span>
        <span className="text-muted">of {totalRooms} rooms open</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-foreground">{availPct}%</span>
        <span className="text-muted">available</span>
        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-available transition-all" style={{ width: `${availPct}%` }} />
        </div>
      </div>
      {soonestRoom && soonest && (
        <Link
          href={`/room/${soonestRoom.id}?date=${date}`}
          className="flex items-center gap-1.5 text-primary hover:underline cursor-pointer"
        >
          <span className="text-muted">Next opening:</span>
          <span className="font-semibold">{formatTimeShort(soonest.start)}</span>
          <span className="text-muted hidden sm:inline">({soonestRoom.name})</span>
        </Link>
      )}
    </div>
  );
}
