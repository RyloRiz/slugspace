"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LOCATIONS, ROOMS, getFloorsForSelection, getRoomsForSelection } from "../lib/rooms";
import { homePageUrl } from "../lib/booking-url";
import { useFavorites } from "../lib/favorites";
import QuickStats from "./QuickStats";
import RoomCards from "./RoomCards";
import TimeGrid, { SlotData } from "./TimeGrid";

type ViewMode = "cards" | "grid";
type SortMode = "availability" | "name" | "capacity";

const FLOOR_ORDER: Record<string, number> = { "Lower": 0, "Ground": 1, "1st": 2, "2nd": 3, "3rd": 4, "4th": 5 };
const CAPACITY_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 2, label: "2+" },
  { value: 4, label: "4+" },
  { value: 6, label: "6+" },
  { value: 8, label: "8+" },
  { value: 10, label: "10+" },
  { value: 14, label: "14+" },
];

function todayStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function tomorrowStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BookingDashboard() {
  const [date, setDate] = useState(todayStr);
  const [locationId, setLocationId] = useState(LOCATIONS[0].id);
  const [groupId, setGroupId] = useState(LOCATIONS[0].groups[0].id);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const [minCapacity, setMinCapacity] = useState(0);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("availability");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { ids: favoriteIds } = useFavorites();

  const currentLocation = LOCATIONS.find((l) => l.id === locationId)!;
  const rooms = getRoomsForSelection(locationId, groupId);

  const allFloors = useMemo(() => {
    return getFloorsForSelection(locationId, groupId)
      .sort((a, b) => (FLOOR_ORDER[a] ?? 99) - (FLOOR_ORDER[b] ?? 99));
  }, [locationId, groupId]);

  const allFeatures = useMemo(() => {
    const feats = new Set<string>();
    rooms.forEach((r) => r.features.forEach((f) => feats.add(f)));
    return Array.from(feats).sort();
  }, [rooms]);

  const activeFilterCount =
    selectedFloors.length +
    (minCapacity > 0 ? 1 : 0) +
    selectedFeatures.length +
    (onlyAvailable ? 1 : 0) +
    (onlyFavorites ? 1 : 0) +
    (search ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedFloors([]);
    setMinCapacity(0);
    setSelectedFeatures([]);
    setSearch("");
    setOnlyAvailable(false);
    setOnlyFavorites(false);
    setSort("availability");
  };

  const toggleFloor = (f: string) => {
    setSelectedFloors((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const fetchAvailability = useCallback(async (dateStr: string, lid: number, gid: number) => {
    setLoading(true);
    setError(null);
    try {
      const end = tomorrowStr(dateStr);
      const res = await fetch(
        `/api/availability?start=${dateStr}&end=${end}&lid=${lid}&gid=${gid}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSlots(data.slots || []);
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load availability. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability(date, locationId, groupId);
  }, [date, locationId, groupId, fetchAvailability]);

  useEffect(() => {
    const interval = setInterval(() => fetchAvailability(date, locationId, groupId), 120000);
    return () => clearInterval(interval);
  }, [date, locationId, groupId, fetchAvailability]);

  const handleLocationChange = (lid: number) => {
    const loc = LOCATIONS.find((l) => l.id === lid)!;
    setLocationId(lid);
    setGroupId(loc.groups[0].id);
    setSelectedFloors([]);
    setSelectedFeatures([]);
    setSearch("");
  };

  const goToday = () => setDate(todayStr());
  const isToday = date === todayStr();
  const canGoPrev = date > todayStr();
  const goPrev = () => {
    if (!canGoPrev) return;
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split("T")[0]);
  };
  const goNext = () => setDate(tomorrowStr(date));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 dark:bg-surface-dark/80 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.074 2.356M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.356" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-foreground leading-tight hidden sm:block">UCSC Room Booker</h1>
            </Link>

            {/* Location selector */}
            <div className="flex gap-1.5">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleLocationChange(loc.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    locationId === loc.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card dark:bg-card-dark border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" />
                  </svg>
                  {loc.shortName}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {lastRefresh && (
                <span className="text-[10px] text-muted hidden md:block">
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <Link
                href="/planner"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-slate-900 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                title="Study Planner"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="hidden sm:inline">Planner</span>
              </Link>
              <button
                onClick={() => fetchAvailability(date, locationId, groupId)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh"
              >
                <svg className={`w-4 h-4 text-muted ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 space-y-5">
        {/* ── Group Tabs + Date ── */}
        <div className="space-y-3">
          {/* Group tabs */}
          {currentLocation.groups.length > 1 && (
            <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
              {currentLocation.groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => { setGroupId(group.id); setSelectedFloors([]); setSelectedFeatures([]); setSearch(""); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    groupId === group.id
                      ? "bg-card dark:bg-card-dark text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}

          {/* Date Navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={!canGoPrev}
                className={`p-1.5 rounded-lg transition-colors ${
                  canGoPrev
                    ? "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-foreground"
                    : "opacity-25 cursor-not-allowed"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => {
                  if (e.target.value >= todayStr()) setDate(e.target.value);
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker()}
                className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {formatDateDisplay(date)}
              </button>
              <button
                onClick={goNext}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-foreground"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
            {!isToday && (
              <button
                onClick={goToday}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* ── Toolbar: Filters + Sort + View ── */}
        <div className="flex items-center justify-between gap-3 py-2 border-y border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rooms..."
                className="w-36 sm:w-44 pl-8 pr-2 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-background text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:w-56 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Quick toggles */}
            <button
              onClick={() => setOnlyAvailable(!onlyAvailable)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                onlyAvailable
                  ? "bg-available/10 text-available"
                  : "text-muted hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${onlyAvailable ? "bg-available" : "bg-slate-300 dark:bg-slate-600"}`} />
              Available
            </button>
            {favoriteIds.length > 0 && (
              <button
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  onlyFavorites
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill={onlyFavorites ? "currentColor" : "none"} strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                Favorites
              </button>
            )}

            {/* More filters */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                filtersOpen || (activeFilterCount - (onlyAvailable ? 1 : 0) - (onlyFavorites ? 1 : 0) - (search ? 1 : 0)) > 0
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              More
              {(activeFilterCount - (onlyAvailable ? 1 : 0) - (onlyFavorites ? 1 : 0) - (search ? 1 : 0)) > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFilterCount - (onlyAvailable ? 1 : 0) - (onlyFavorites ? 1 : 0) - (search ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Right side: Sort + View */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark text-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="availability">Availability</option>
              <option value="name">Name</option>
              <option value="capacity">Capacity</option>
            </select>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                title="Card view"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                title="Grid view"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Expandable Filter Panel ── */}
        {filtersOpen && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-4 space-y-4 -mt-2">
            {/* Floor pills */}
            {allFloors.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Floor</span>
                <div className="flex flex-wrap gap-1.5">
                  {allFloors.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFloor(f)}
                      aria-pressed={selectedFloors.includes(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        selectedFloors.includes(f)
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Capacity pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Min. Capacity</span>
              <div className="flex flex-wrap gap-1.5">
                {CAPACITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setMinCapacity(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      minCapacity === value
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature pills */}
            {allFeatures.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Features</span>
                <div className="flex flex-wrap gap-1.5">
                  {allFeatures.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFeature(f)}
                      aria-pressed={selectedFeatures.includes(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        selectedFeatures.includes(f)
                          ? "bg-accent/15 text-accent border-accent/30 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-muted hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted">{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-primary hover:underline cursor-pointer font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active filter pills (when panel closed) */}
        {!filtersOpen && activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap -mt-2">
            {selectedFloors.map((f) => (
              <button key={f} onClick={() => toggleFloor(f)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary cursor-pointer hover:bg-primary/15 transition-colors">
                {f}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            ))}
            {minCapacity > 0 && (
              <button onClick={() => setMinCapacity(0)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary cursor-pointer hover:bg-primary/15 transition-colors">
                {minCapacity}+ seats
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {selectedFeatures.map((f) => (
              <button key={f} onClick={() => toggleFeature(f)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent cursor-pointer hover:bg-accent/15 transition-colors">
                {f}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            ))}
            <button onClick={clearAllFilters} className="text-[10px] text-muted hover:text-foreground cursor-pointer ml-1">Clear all</button>
          </div>
        )}

        {/* ── Quick Stats ── */}
        {!loading && !error && slots.length > 0 && <QuickStats slots={slots} rooms={rooms} today={todayStr()} date={date} />}

        {/* ── Empty / Error / Loading states ── */}
        {!loading && !error && slots.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card dark:bg-card-dark p-8 text-center space-y-2">
            {date > todayStr() ? (
              <>
                <svg className="w-8 h-8 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">Not yet open for booking</p>
                <p className="text-xs text-muted">This date is too far ahead. The library typically opens bookings 1-2 weeks in advance.</p>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm font-semibold text-foreground">No availability data</p>
                <p className="text-xs text-muted">The library may be closed on this day (weekend or holiday).</p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-booked/30 bg-booked/5 p-4 text-sm text-booked">
            {error}
            <button onClick={() => fetchAvailability(date, locationId, groupId)} className="ml-2 underline cursor-pointer">Retry</button>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3" />
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full mb-3" />
                  <div className="space-y-1.5">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        {!loading && !error && slots.length > 0 && (
          viewMode === "cards" ? (
            <RoomCards
              slots={slots}
              rooms={rooms}
              date={date}
              today={todayStr()}
              filter={{ floors: selectedFloors, minCapacity, onlyAvailable, onlyFavorites, features: selectedFeatures, search, sort }}
            />
          ) : (
            <TimeGrid slots={slots} rooms={rooms} date={date} today={todayStr()} />
          )
        )}

        {/* Legend */}
        {!loading && !error && slots.length > 0 && (
          <div className="flex items-center gap-4 py-3 text-[11px] text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-available/20 border border-available" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-booked/15 border border-booked/30" />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 opacity-40" />
              <span>Past</span>
            </div>
            <span className="hidden sm:inline text-muted/60">Auto-refreshes every 2 min</span>
          </div>
        )}

        {/* Planner CTA */}
        {!loading && !error && (
          <Link
            href="/planner"
            className="group flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 hover:bg-accent/10 p-4 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Plan your weekly study schedule</p>
              <p className="text-xs text-muted">Tell us when and how you study — we&apos;ll find the best rooms and times for you.</p>
            </div>
            <svg className="w-5 h-5 text-muted group-hover:text-foreground transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-xs text-muted text-center">
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
