"use client";

import Link from "next/link";
import { Room } from "../lib/rooms";
import { useFavorites } from "../lib/favorites";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { SlotData } from "./TimeGrid";

interface RoomCardsProps {
  slots: SlotData[];
  rooms: Room[];
  date: string;
  today: string;
  filter: {
    floors: string[];
    minCapacity: number;
    onlyAvailable: boolean;
    onlyFavorites: boolean;
    features: string[];
    search: string;
    sort: string;
  };
}

function formatTime(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function getConsecutiveBlocks(
  roomSlots: { time: string; bookable: boolean; slot?: SlotData }[]
): { start: string; end: string; durationMins: number; slots: SlotData[] }[] {
  const blocks: { start: string; end: string; durationMins: number; slots: SlotData[] }[] = [];
  let current: SlotData[] = [];

  for (const rs of roomSlots) {
    if (rs.bookable && rs.slot) {
      current.push(rs.slot);
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

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

type RoomStatus = "open" | "busy-later" | "fully-booked";

export default function RoomCards({ slots, rooms, date, today, filter }: RoomCardsProps) {
  const { isFavorite, toggle } = useFavorites();

  const slotsByRoom = new Map<number, SlotData[]>();
  slots.forEach((s) => {
    const arr = slotsByRoom.get(s.itemId) || [];
    arr.push(s);
    slotsByRoom.set(s.itemId, arr);
  });

  let filteredRooms = rooms;
  if (filter.floors.length > 0) {
    filteredRooms = filteredRooms.filter((r) => filter.floors.includes(r.floor));
  }
  if (filter.minCapacity > 0) {
    filteredRooms = filteredRooms.filter((r) => r.capacity >= filter.minCapacity);
  }
  if (filter.features.length > 0) {
    filteredRooms = filteredRooms.filter((r) =>
      filter.features.every((f) => r.features.includes(f))
    );
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    filteredRooms = filteredRooms.filter((r) => r.name.toLowerCase().includes(q));
  }
  if (filter.onlyFavorites) {
    filteredRooms = filteredRooms.filter((r) => isFavorite(r.id));
  }

  const roomData = filteredRooms.map((room) => {
    const roomSlots = (slotsByRoom.get(room.id) || [])
      .sort((a, b) => a.start.localeCompare(b.start))
      .filter((s) => isSlotFuture(s, today))
      .map((s) => ({
        time: s.start,
        bookable: isSlotAvailable(s),
        slot: s,
      }));

    const blocks = getConsecutiveBlocks(roomSlots);
    const bookableCount = roomSlots.filter((s) => s.bookable).length;

    let status: RoomStatus;
    if (bookableCount > 0) {
      status = "open";
    } else {
      status = "fully-booked";
    }

    return { room, blocks, bookableCount, status };
  });

  if (filter.onlyAvailable) {
    roomData.splice(0, roomData.length, ...roomData.filter((r) => r.bookableCount > 0));
  }

  // Sort: favorites always first, then by chosen sort
  roomData.sort((a, b) => {
    const aFav = isFavorite(a.room.id) ? 1 : 0;
    const bFav = isFavorite(b.room.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;

    if (filter.sort === "name") {
      return a.room.name.localeCompare(b.room.name);
    }
    if (filter.sort === "capacity") {
      return b.room.capacity - a.room.capacity;
    }
    // Default: availability
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    return b.bookableCount - a.bookableCount;
  });

  if (roomData.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <p>{filter.onlyFavorites ? "No favorite rooms in this view. Star some rooms to see them here." : "No rooms match your filters."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roomData.map(({ room, blocks, status }) => {
        const faved = isFavorite(room.id);
        return (
          <div
            key={room.id}
            className={`relative rounded-xl border p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
              status === "open"
                ? "border-available/30 bg-card dark:bg-card-dark hover:border-available/60"
                : "border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark opacity-60 hover:opacity-80"
            }`}
          >
            {/* Favorite button */}
            <button
              onClick={(e) => { e.preventDefault(); toggle(room.id); }}
              className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors cursor-pointer z-10 ${
                faved
                  ? "text-accent hover:text-accent-hover"
                  : "text-slate-300 dark:text-slate-600 hover:text-accent/60"
              }`}
              aria-label={faved ? "Remove from favorites" : "Add to favorites"}
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill={faved ? "currentColor" : "none"} strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </button>

            <Link
              href={`/room/${room.id}?date=${date}`}
              className="block cursor-pointer"
            >
              {/* Status badge */}
              <div className="flex items-center justify-between mb-3 pr-8">
                {status === "open" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-available/10 text-available border border-available/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-available animate-pulse" />
                    Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-booked/10 text-booked border border-booked/20">
                    Fully Booked
                  </span>
                )}
                <span className="text-xs text-muted">Cap. {room.capacity}</span>
              </div>

              {/* Room name & info */}
              <h3 className="font-semibold text-foreground text-base">{room.name}</h3>
              <p className="text-xs text-muted mt-0.5">
                {room.floor} Floor
                {room.features.length > 0 && (
                  <>
                    {" · "}
                    {room.features.map((f) => (
                      <span key={f} className="inline-block px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-medium mr-1">
                        {f}
                      </span>
                    ))}
                  </>
                )}
              </p>

              {/* Available time blocks */}
              {blocks.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                    Available times
                  </p>
                  {blocks.slice(0, 3).map((block, i) => {
                    const over4h = block.durationMins > 240;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-available/5 border border-available/15"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {formatTime(block.start)} – {formatTime(block.end)}
                        </span>
                        <span className={`text-xs font-medium ${over4h ? "text-accent" : "text-available"}`}>
                          {formatDuration(block.durationMins)}
                          {over4h && " *"}
                        </span>
                      </div>
                    );
                  })}
                  {blocks.some((b) => b.durationMins > 240) && (
                    <p className="text-[10px] text-accent pl-1">* exceeds 4 hr daily limit</p>
                  )}
                  {blocks.length > 3 && (
                    <p className="text-xs text-muted pl-1">+{blocks.length - 3} more open windows</p>
                  )}
                </div>
              ) : (
                <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-muted">No remaining time slots today</p>
                </div>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
