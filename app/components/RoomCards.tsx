"use client";

import Link from "next/link";
import { Room } from "../lib/rooms";
import { useFavorites } from "../lib/favorites";
import { useAlerts } from "../lib/alerts";
import { useBookingQueue } from "../lib/booking-queue";
import { useRoomNotes } from "../lib/room-notes";
import { bookingUrl } from "../lib/booking-url";
import { isSlotAvailable, isSlotFuture } from "../lib/slots";
import { getQuickTrend, formatTrendHour, trendLabel } from "../lib/trends";
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
  const { isWatching, addAlert, removeAlert } = useAlerts();
  const { isQueued, toggleSlot } = useBookingQueue();
  const { hasNote, getNote } = useRoomNotes();

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

  // Sort by chosen sort mode
  roomData.sort((a, b) => {
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
      <div className="flex flex-col items-center justify-center py-20 text-muted gap-2">
        <svg className="w-8 h-8 text-muted/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <p className="text-sm">{filter.onlyFavorites ? "No favorite rooms in this view. Star some rooms to see them here." : "No rooms match your filters."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {roomData.map(({ room, blocks, status }, idx) => {
        const faved = isFavorite(room.id);
        return (
          <div
            key={room.id}
            className={`relative rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
              status === "open"
                ? "border-available/20 bg-card dark:bg-card-dark hover:border-available/40 hover:shadow-available/5"
                : "border-border dark:border-border-dark bg-card dark:bg-card-dark opacity-55 hover:opacity-75"
            }`}
            style={{ animationDelay: `${idx * 0.03}s` }}
          >
            {/* Favorite button */}
            <button
              onClick={(e) => { e.preventDefault(); toggle(room.id); }}
              className={`absolute top-4 right-4 p-1.5 rounded-xl transition-all cursor-pointer z-10 ${
                faved
                  ? "text-accent hover:text-accent-hover scale-110"
                  : "text-muted/20 hover:text-accent/50 hover:scale-110"
              }`}
              aria-label={faved ? "Remove from favorites" : "Add to favorites"}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={faved ? "currentColor" : "none"} strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </button>

            <Link
              href={`/room/${room.id}?date=${date}`}
              className="block cursor-pointer"
            >
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4 pr-8">
                {status === "open" ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-available/8 text-available border border-available/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-available animate-pulse-soft" />
                    Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-booked/8 text-booked border border-booked/15">
                    Fully Booked
                  </span>
                )}
                <span className="text-[11px] text-muted font-medium tabular-nums">{room.capacity} seats</span>
              </div>

              {/* Room name & info */}
              <h3
                className="font-normal text-foreground text-lg leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {room.name}
              </h3>
              <p className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{room.floor} Floor</span>
                {room.features.length > 0 && (
                  <>
                    <span className="text-muted/30">·</span>
                    {room.features.map((f) => (
                      <span key={f} className="inline-block px-2 py-0.5 rounded-md bg-accent/8 text-accent text-[10px] font-semibold">
                        {f}
                      </span>
                    ))}
                  </>
                )}
              </p>

              {/* Personal note */}
              {hasNote(room.id) && (
                <div className="mt-2.5 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/4 dark:bg-secondary/4 border border-primary/8 dark:border-secondary/8">
                  <svg className="w-3 h-3 text-primary/40 dark:text-secondary/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <p className="text-[10px] text-muted leading-snug line-clamp-2">{getNote(room.id)}</p>
                </div>
              )}

              {/* Trend insight */}
              {(() => {
                const trend = getQuickTrend(room.id, date);
                if (!trend || trend.dayRate === null) return null;
                const label = trendLabel(trend.dayRate);
                const isGood = trend.dayRate >= 0.6;
                const isBad = trend.dayRate < 0.3;
                return (
                  <div className={`mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold ${
                    isGood ? "bg-available/6 text-available" : isBad ? "bg-booked/6 text-booked" : "bg-accent/6 text-accent"
                  }`}>
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <span>{label}</span>
                    {trend.bestHours.length > 0 && (
                      <span className="text-muted font-normal ml-0.5">
                        · Best at {trend.bestHours.slice(0, 2).map((h) => formatTrendHour(h.hour)).join(", ")}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Available time blocks */}
              {blocks.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Available
                  </p>
                  {blocks.slice(0, 3).map((block, i) => {
                    const over4h = block.durationMins > 240;
                    const url = bookingUrl(room.id, { start: block.start, end: block.end, roomName: room.name });
                    const queued = isQueued(room.id, block.start);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-available/4 border border-available/10 hover:border-available/20 transition-colors"
                      >
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatTime(block.start)} – {formatTime(block.end)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSlot(room.id, room.name, date, block.start, block.end, url);
                            }}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              queued
                                ? "text-primary dark:text-secondary bg-primary/10 dark:bg-secondary/10"
                                : "text-muted/30 hover:text-primary/60 dark:hover:text-secondary/60"
                            }`}
                            title={queued ? "Remove from queue" : "Add to queue"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d={queued
                                ? "M4.5 12.75l6 6 9-13.5"
                                : "M12 4.5v15m7.5-7.5h-15"
                              } />
                            </svg>
                          </button>
                          <span className={`text-[11px] font-bold ${over4h ? "text-accent" : "text-available"}`}>
                            {formatDuration(block.durationMins)}
                            {over4h && " *"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {blocks.some((b) => b.durationMins > 240) && (
                    <p className="text-[10px] text-accent font-medium pl-1">* exceeds 4 hr daily limit</p>
                  )}
                  {blocks.length > 3 && (
                    <p className="text-[11px] text-muted pl-1 font-medium">+{blocks.length - 3} more open windows</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <div className="px-3.5 py-2.5 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
                    <p className="text-xs text-muted">No remaining time slots today</p>
                  </div>
                  {(() => {
                    const watching = isWatching(room.id, date);
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (watching) {
                            removeAlert(`${room.id}-${date}`);
                          } else {
                            addAlert(room.id, room.name, date);
                          }
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                          watching
                            ? "bg-accent/8 text-accent border-accent/20"
                            : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-foreground/20"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={watching
                            ? "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                            : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          } />
                          {!watching && <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
                        </svg>
                        {watching ? "Watching for openings" : "Watch for openings"}
                      </button>
                    );
                  })()}
                </div>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
