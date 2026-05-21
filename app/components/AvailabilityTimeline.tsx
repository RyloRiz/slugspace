"use client";

import { useMemo } from "react";
import { Room } from "../lib/rooms";
import { isSlotAvailable } from "../lib/slots";
import { SlotData } from "./TimeGrid";

interface AvailabilityTimelineProps {
  slots: SlotData[];
  rooms: Room[];
  date: string;
  today: string;
}

interface HourBucket {
  hour: number;
  total: number;
  available: number;
  rate: number;
  isPast: boolean;
  isCurrent: boolean;
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

function formatHourFull(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function AvailabilityTimeline({ slots, date, today }: AvailabilityTimelineProps) {
  const { buckets, bestWindow, busiestHour } = useMemo(() => {
    const now = new Date();
    const nowHour = now.getHours();
    const isToday = date === today;

    // Aggregate slots into hourly buckets
    const hourMap = new Map<number, { total: number; available: number }>();

    for (const slot of slots) {
      const time = slot.start.split(" ")[1];
      const hour = parseInt(time.split(":")[0]);
      const entry = hourMap.get(hour) || { total: 0, available: 0 };
      entry.total++;
      if (isSlotAvailable(slot)) entry.available++;
      hourMap.set(hour, entry);
    }

    const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);
    const buckets: HourBucket[] = hours.map((hour) => {
      const data = hourMap.get(hour)!;
      return {
        hour,
        total: data.total,
        available: data.available,
        rate: data.total > 0 ? data.available / data.total : 0,
        isPast: isToday && hour < nowHour,
        isCurrent: isToday && hour === nowHour,
      };
    });

    // Best 2-hour window among non-past hours
    const futureBuckets = buckets.filter((b) => !b.isPast);
    let bestWindow: { startHour: number; endHour: number; avgRate: number } | null = null;
    for (let i = 0; i < futureBuckets.length - 1; i++) {
      if (futureBuckets[i + 1].hour - futureBuckets[i].hour <= 1) {
        const avgRate = (futureBuckets[i].rate + futureBuckets[i + 1].rate) / 2;
        if (!bestWindow || avgRate > bestWindow.avgRate) {
          bestWindow = {
            startHour: futureBuckets[i].hour,
            endHour: futureBuckets[i + 1].hour + 1,
            avgRate,
          };
        }
      }
    }

    // Busiest future hour
    const active = futureBuckets.filter((b) => b.total > 0);
    const busiestHour = active.length > 0
      ? active.reduce((min, b) => b.rate < min.rate ? b : min, active[0])
      : null;

    return { buckets, bestWindow, busiestHour };
  }, [slots, date, today]);

  if (buckets.length === 0) return null;

  const isToday = date === today;

  return (
    <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 sm:p-6">
      {/* Header row */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-3 mb-5">
        <div>
          <h2
            className="text-base font-normal text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {isToday ? "Today\u2019s Availability" : "Availability by Hour"}
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            How open each hour is across all rooms
          </p>
        </div>

        {/* Insight pills */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {bestWindow && bestWindow.avgRate > 0.2 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-available/8 text-available text-[10px] font-bold border border-available/15">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Best: {formatHourFull(bestWindow.startHour)} – {formatHourFull(bestWindow.endHour)}
            </span>
          )}
          {busiestHour && busiestHour.rate < 0.25 && (
            <span className="items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-booked/6 text-booked text-[10px] font-bold border border-booked/10 hidden sm:inline-flex">
              Busy: {formatHourFull(busiestHour.hour)}
            </span>
          )}
        </div>
      </div>

      {/* Chart: each bar's height = availability rate (0-100%) */}
      <div className="flex items-end gap-[3px] sm:gap-1.5" style={{ height: 112 }}>
        {buckets.map((b) => {
          const pct = Math.round(b.rate * 100);
          // Minimum visible height so even 0% shows a sliver
          const barH = Math.max(b.rate * 100, 3);

          let color: string;
          if (b.isPast) {
            color = "bg-muted/8";
          } else if (b.rate >= 0.6) {
            color = "bg-available";
          } else if (b.rate >= 0.3) {
            color = "bg-accent";
          } else if (b.rate > 0) {
            color = "bg-booked/70";
          } else {
            color = "bg-booked/30";
          }

          return (
            <div key={b.hour} className="flex-1 relative group flex flex-col justify-end h-full min-w-0">
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-foreground text-background text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg tabular-nums">
                  {formatHourFull(b.hour)}: {b.available}/{b.total} open · {pct}%
                </div>
              </div>

              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all ${color} ${
                  b.isCurrent ? "ring-2 ring-primary/40 dark:ring-secondary/40 ring-offset-1 ring-offset-card dark:ring-offset-card-dark" : ""
                } ${b.isPast ? "" : "hover:opacity-80 cursor-default"}`}
                style={{ height: `${barH}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-[3px] sm:gap-1.5 mt-1.5">
        {buckets.map((b, i) => (
          <div key={b.hour} className="flex-1 min-w-0 text-center overflow-hidden">
            <span
              className={`text-[8px] sm:text-[9px] tabular-nums leading-none ${
                b.isCurrent ? "text-primary dark:text-secondary font-bold" : "text-muted"
              } ${i % 2 !== 0 ? "hidden sm:inline" : "inline"}`}
            >
              {formatHourLabel(b.hour)}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 sm:gap-5 mt-4 pt-3 border-t border-border dark:border-border-dark">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-available" />
          <span className="text-[10px] text-muted">Quiet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
          <span className="text-[10px] text-muted">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-booked/70" />
          <span className="text-[10px] text-muted">Busy</span>
        </div>
        {isToday && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-muted/8 ring-1 ring-primary/40 dark:ring-secondary/40" />
            <span className="text-[10px] text-muted">Now</span>
          </div>
        )}
      </div>
    </div>
  );
}
