"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { LOCATIONS, ROOMS, getFloorsForSelection, getRoomsForSelection } from "../lib/rooms";
import { homePageUrl } from "../lib/booking-url";
import { useFavorites } from "../lib/favorites";
import { checkAlerts } from "../lib/alerts";
import { recordAvailability } from "../lib/trends";
import QuickStats from "./QuickStats";
import RoomCards from "./RoomCards";
import TimeGrid, { SlotData } from "./TimeGrid";
import CramSession from "./CramSession";
import AlertPanel from "./AlertPanel";
import BookingQueue from "./BookingQueue";
import BookingHistory from "./BookingHistory";
import { useFilterPresets, FilterPreset } from "../lib/filter-presets";

type ViewMode = "cards" | "grid";
type SortMode = "availability" | "name" | "capacity";

const FLOOR_ORDER: Record<string, number> = { "Lower": 0, "Ground": 1, "1st": 2, "2nd": 3, "3rd": 4, "4th": 5 };

const LIBRARY_IMAGES: Record<number, { hero: string; alt: string }> = {
  16578: { hero: "/libraries/se-hero.png", alt: "Science & Engineering Library" },
  16577: { hero: "/libraries/mchenry-hero.png", alt: "McHenry Library" },
};
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  });
}

function formatDateYear(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric" });
}

export default function BookingDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialDate = searchParams.get("date") || todayStr();
  const initialView = (searchParams.get("view") === "grid" ? "grid" : "cards") as ViewMode;

  const [date, setDateState] = useState(initialDate);
  const [locationId, setLocationId] = useState(LOCATIONS[0].id);
  const [groupId, setGroupId] = useState(LOCATIONS[0].groups[0].id);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>(initialView);

  const updateUrl = useCallback((newDate: string, newView: ViewMode) => {
    const params = new URLSearchParams();
    if (newDate !== todayStr()) params.set("date", newDate);
    if (newView !== "cards") params.set("view", newView);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  }, [router]);

  const setDate = useCallback((d: string) => {
    setDateState(d);
    updateUrl(d, viewMode);
  }, [updateUrl, viewMode]);

  const setViewMode = useCallback((v: ViewMode) => {
    setViewModeState(v);
    updateUrl(date, v);
  }, [updateUrl, date]);
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const [minCapacity, setMinCapacity] = useState(0);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("availability");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showPresetSave, setShowPresetSave] = useState(false);
  const { ids: favoriteIds } = useFavorites();
  const { presets, addPreset, removePreset } = useFilterPresets();

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

  const advancedFilterCount =
    selectedFloors.length +
    (minCapacity > 0 ? 1 : 0) +
    selectedFeatures.length;

  const clearAllFilters = () => {
    setSelectedFloors([]);
    setMinCapacity(0);
    setSelectedFeatures([]);
    setSearch("");
    setOnlyAvailable(false);
    setOnlyFavorites(false);
    setSort("availability");
  };

  const applyPreset = (preset: FilterPreset) => {
    handleLocationChange(preset.locationId);
    // Need to set groupId after location change
    setGroupId(preset.groupId);
    setSelectedFloors(preset.floors);
    setMinCapacity(preset.minCapacity);
    setSelectedFeatures(preset.features);
    setOnlyAvailable(preset.onlyAvailable);
    setOnlyFavorites(preset.onlyFavorites);
    setSort(preset.sort as SortMode);
    setSearch("");
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    addPreset({
      name: presetName.trim(),
      locationId,
      groupId,
      floors: selectedFloors,
      minCapacity,
      features: selectedFeatures,
      onlyAvailable,
      onlyFavorites,
      sort,
    });
    setPresetName("");
    setShowPresetSave(false);
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

  const fetchAvailability = useCallback(async (dateStr: string, lid: number, gid: number, silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const end = tomorrowStr(dateStr);
      const res = await fetch(
        `/api/availability?start=${dateStr}&end=${end}&lid=${lid}&gid=${gid}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const newSlots = data.slots || [];
      setSlots(newSlots);
      setLastRefresh(new Date());
      // Check slot watch alerts against fresh data
      checkAlerts(newSlots);
      // Record availability data for trend analysis
      recordAvailability(newSlots);
    } catch {
      if (!silent) setError("Failed to load availability. Please try again.");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability(date, locationId, groupId);
  }, [date, locationId, groupId, fetchAvailability]);

  useEffect(() => {
    const interval = setInterval(() => fetchAvailability(date, locationId, groupId, true), 120000);
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
      <header className="sticky top-0 z-50 bg-primary text-white">
        <div className="max-w-6xl mx-auto px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0 group cursor-pointer">
              <Image
                src="/ucscbooking.png"
                alt="SlugSpace"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-normal text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  SlugSpace
                </h1>
                <p className="text-[10px] text-white/50 tracking-widest uppercase">UC Santa Cruz</p>
              </div>
            </Link>

            {/* Location selector — centered */}
            <nav className="flex gap-1 p-1 rounded-2xl bg-white/8 overflow-x-auto scrollbar-none">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleLocationChange(loc.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    locationId === loc.id
                      ? "bg-accent text-primary shadow-md shadow-black/15"
                      : "text-white/70 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {loc.shortName}
                </button>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {lastRefresh && (
                <span className="text-[10px] text-white/40 hidden lg:block tabular-nums">
                  {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer backdrop-blur-sm"
                title="Study Planner"
              >
                <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="hidden sm:inline">Planner</span>
              </Link>
              <AlertPanel />
              <button
                onClick={() => fetchAvailability(date, locationId, groupId, true)}
                className="p-2.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                title="Refresh"
              >
                <svg className={`w-4 h-4 text-white/70 transition-transform ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Library Hero Banner ── */}
      <div className="relative h-40 sm:h-48 md:h-56 overflow-hidden">
        <Image
          src={LIBRARY_IMAGES[locationId]?.hero || LIBRARY_IMAGES[16578].hero}
          alt={LIBRARY_IMAGES[locationId]?.alt || "Library"}
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-primary/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />

        {/* Content overlay — date hero + group tabs */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-5 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
            {/* Group tabs */}
            {currentLocation.groups.length > 1 && (
              <div className="flex gap-1 p-0.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 w-fit max-w-full overflow-x-auto scrollbar-none">
                {currentLocation.groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => { setGroupId(group.id); setSelectedFloors([]); setSelectedFeatures([]); setSearch(""); }}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      groupId === group.id
                        ? "bg-white/90 text-primary shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}

            {/* Date Navigation */}
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
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
                  className="text-left cursor-pointer group"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 sm:mb-1.5 text-white/60">
                    {isToday ? "Today" : "Viewing"}
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl md:text-4xl text-white leading-none drop-shadow-sm group-hover:text-accent transition-colors"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {formatDateDisplay(date)}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/50 mt-1">{formatDateYear(date)}</p>
                </button>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 pb-1 shrink-0">
                <button
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  className={`p-2 rounded-xl transition-all ${
                    canGoPrev
                      ? "hover:bg-white/15 cursor-pointer text-white border border-transparent hover:border-white/20"
                      : "opacity-20 cursor-not-allowed text-white/40"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                {!isToday && (
                  <button
                    onClick={goToday}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold text-primary bg-white hover:bg-white/90 shadow-sm hover:shadow transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    Today
                  </button>
                )}
                <button
                  onClick={goNext}
                  className="p-2 rounded-xl hover:bg-white/15 border border-transparent hover:border-white/20 transition-all cursor-pointer text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* ── Quick Book ── */}
        {!loading && !error && (
          <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <CramSession initialDate={date} />
          </div>
        )}

        {/* ── Quick Stats ── */}
        {!loading && !error && slots.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
            <QuickStats slots={slots} rooms={rooms} today={todayStr()} date={date} />
          </div>
        )}

        {/* ── Booking History ── */}
        {!loading && !error && (
          <div className="animate-fade-in-up" style={{ animationDelay: "0.09s" }}>
            <BookingHistory />
          </div>
        )}

        {/* ── Toolbar ── */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3 border-y border-border dark:border-border-dark animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rooms..."
                className="w-full sm:w-44 pl-9 pr-3 py-2 rounded-xl text-xs border border-border dark:border-border-dark bg-card dark:bg-card-dark text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 sm:focus:w-56 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
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
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                onlyAvailable
                  ? "bg-available/8 text-available border-available/20"
                  : "text-muted hover:text-foreground border-transparent hover:bg-surface dark:hover:bg-surface-dark"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${onlyAvailable ? "bg-available animate-pulse-soft" : "bg-muted/30"}`} />
              Available
            </button>
            {favoriteIds.length > 0 && (
              <button
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  onlyFavorites
                    ? "bg-accent/8 text-accent border-accent/20"
                    : "text-muted hover:text-foreground border-transparent hover:bg-surface dark:hover:bg-surface-dark"
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
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                filtersOpen || advancedFilterCount > 0
                  ? "bg-primary/5 text-primary dark:text-secondary border-primary/15 dark:border-secondary/15"
                  : "text-muted hover:text-foreground border-transparent hover:bg-surface dark:hover:bg-surface-dark"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
              {advancedFilterCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center -mr-0.5">
                  {advancedFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Right side: Sort + View */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-border dark:border-border-dark bg-card dark:bg-card-dark text-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="availability">Availability</option>
              <option value="name">Name</option>
              <option value="capacity">Capacity</option>
            </select>
            <div className="flex rounded-xl border border-border dark:border-border-dark overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface dark:hover:bg-surface-dark bg-card dark:bg-card-dark"
                }`}
                title="Card view"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface dark:hover:bg-surface-dark bg-card dark:bg-card-dark"
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
          <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 space-y-5 -mt-3 shadow-sm">
            {/* Floor pills */}
            {allFloors.length > 1 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Floor</span>
                <div className="flex flex-wrap gap-2">
                  {allFloors.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFloor(f)}
                      aria-pressed={selectedFloors.includes(f)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        selectedFloors.includes(f)
                          ? "bg-primary text-white border-primary shadow-sm shadow-primary/15"
                          : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Capacity pills */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Min. Capacity</span>
              <div className="flex flex-wrap gap-2">
                {CAPACITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setMinCapacity(value)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      minCapacity === value
                        ? "bg-primary text-white border-primary shadow-sm shadow-primary/15"
                        : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature pills */}
            {allFeatures.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Features</span>
                <div className="flex flex-wrap gap-2">
                  {allFeatures.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFeature(f)}
                      aria-pressed={selectedFeatures.includes(f)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        selectedFeatures.includes(f)
                          ? "bg-accent/10 text-accent border-accent/25 shadow-sm"
                          : "border-border dark:border-border-dark text-muted hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Presets */}
            {(presets.length > 0 || advancedFilterCount > 0) && (
              <div className="space-y-2 pt-3 border-t border-border dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Saved Presets</span>
                  {advancedFilterCount > 0 && !showPresetSave && (
                    <button
                      onClick={() => setShowPresetSave(true)}
                      className="text-[11px] font-semibold text-primary dark:text-secondary hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Save current
                    </button>
                  )}
                </div>

                {/* Save form */}
                {showPresetSave && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCurrentAsPreset();
                        if (e.key === "Escape") { setShowPresetSave(false); setPresetName(""); }
                      }}
                      placeholder="Preset name..."
                      maxLength={30}
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                    />
                    <button
                      onClick={saveCurrentAsPreset}
                      disabled={!presetName.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary dark:bg-secondary text-white hover:bg-primary/90 dark:hover:bg-secondary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowPresetSave(false); setPresetName(""); }}
                      className="px-2 py-1.5 rounded-lg text-xs text-muted hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Preset list */}
                {presets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p) => {
                      const loc = LOCATIONS.find((l) => l.id === p.locationId);
                      const summary = [
                        loc?.shortName,
                        ...p.floors,
                        p.minCapacity > 0 ? `${p.minCapacity}+` : null,
                        ...p.features,
                        p.onlyFavorites ? "Favs" : null,
                      ].filter(Boolean).join(", ");
                      return (
                        <div key={p.id} className="group flex items-center gap-1">
                          <button
                            onClick={() => applyPreset(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 hover:border-accent/30 transition-all cursor-pointer"
                            title={summary}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                            {p.name}
                          </button>
                          <button
                            onClick={() => removePreset(p.id)}
                            className="p-1 rounded-md text-muted/0 group-hover:text-muted/40 hover:!text-booked transition-colors cursor-pointer"
                            title="Delete preset"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {presets.length === 0 && !showPresetSave && (
                  <p className="text-[11px] text-muted/50">No saved presets yet. Set your filters and save them for quick access.</p>
                )}
              </div>
            )}

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border-dark">
                <span className="text-xs text-muted">{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-primary dark:text-secondary hover:underline cursor-pointer font-semibold"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active filter pills (when panel closed) */}
        {!filtersOpen && advancedFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap -mt-3">
            {selectedFloors.map((f) => (
              <button key={f} onClick={() => toggleFloor(f)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/8 text-primary dark:text-secondary cursor-pointer hover:bg-primary/12 transition-colors border border-primary/10 dark:border-secondary/10">
                {f}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            ))}
            {minCapacity > 0 && (
              <button onClick={() => setMinCapacity(0)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/8 text-primary dark:text-secondary cursor-pointer hover:bg-primary/12 transition-colors border border-primary/10 dark:border-secondary/10">
                {minCapacity}+ seats
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {selectedFeatures.map((f) => (
              <button key={f} onClick={() => toggleFeature(f)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-accent/8 text-accent cursor-pointer hover:bg-accent/12 transition-colors border border-accent/10">
                {f}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            ))}
            <button onClick={clearAllFilters} className="text-[11px] text-muted hover:text-foreground cursor-pointer ml-1 font-medium">Clear all</button>
          </div>
        )}

        {/* Quick preset pills (when panel closed) */}
        {!filtersOpen && presets.length > 0 && advancedFilterCount === 0 && (
          <div className="flex items-center gap-2 flex-wrap -mt-3">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">Presets</span>
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-accent/5 text-accent cursor-pointer hover:bg-accent/10 transition-colors border border-accent/10"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Empty / Error / Loading states ── */}
        {!loading && !error && slots.length === 0 && (
          <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-8 sm:p-12 text-center space-y-3">
            {date > todayStr() ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-surface dark:bg-surface-dark flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Not yet open for booking</p>
                <p className="text-sm text-muted max-w-md mx-auto">This date is too far ahead. The library typically opens bookings 1-2 weeks in advance.</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-surface dark:bg-surface-dark flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>No availability data</p>
                <p className="text-sm text-muted max-w-md mx-auto">The library may be closed on this day (weekend or holiday).</p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-booked/20 bg-booked/5 p-5 text-sm text-booked flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchAvailability(date, locationId, groupId)} className="text-sm font-semibold underline underline-offset-2 cursor-pointer shrink-0">Retry</button>
          </div>
        )}

        {loading && (
          <div className="space-y-6">
            {/* Stats skeleton */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 animate-pulse">
                  <div className="h-8 bg-surface dark:bg-surface-dark rounded-lg w-20 mb-2" />
                  <div className="h-3 bg-surface dark:bg-surface-dark rounded w-28" />
                </div>
              ))}
            </div>
            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5 animate-pulse">
                  <div className="h-5 bg-surface dark:bg-surface-dark rounded-lg w-20 mb-3" />
                  <div className="h-5 bg-surface dark:bg-surface-dark rounded-lg w-40 mb-2" />
                  <div className="h-3 bg-surface dark:bg-surface-dark rounded w-52 mb-4" />
                  <div className="space-y-2">
                    <div className="h-10 bg-surface dark:bg-surface-dark rounded-xl" />
                    <div className="h-10 bg-surface dark:bg-surface-dark rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        {!loading && !error && slots.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            {viewMode === "cards" ? (
              <RoomCards
                slots={slots}
                rooms={rooms}
                date={date}
                today={todayStr()}
                filter={{ floors: selectedFloors, minCapacity, onlyAvailable, onlyFavorites, features: selectedFeatures, search, sort }}
              />
            ) : (
              <TimeGrid slots={slots} rooms={rooms} date={date} today={todayStr()} filter={{ floors: selectedFloors, minCapacity, onlyAvailable, onlyFavorites, features: selectedFeatures, search, sort }} />
            )}
          </div>
        )}

        {/* Legend — only for cards view (TimeGrid has its own) */}
        {!loading && !error && slots.length > 0 && viewMode === "cards" && (
          <div className="flex items-center gap-5 py-3 text-xs text-muted">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-available/15 border border-available/30" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-booked/10 border border-booked/20" />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-surface dark:bg-surface-dark border border-border dark:border-border-dark" />
              <span>Past</span>
            </div>
            <span className="hidden sm:inline text-muted/50">Auto-refreshes every 2 min</span>
          </div>
        )}

        {/* Planner CTA */}
        {!loading && !error && (
          <Link
            href="/planner"
            className="group relative flex items-center gap-4 sm:gap-5 rounded-2xl overflow-hidden p-4 sm:p-6 transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/10"
          >
            <Image
              src="/libraries/se-exterior.jpeg"
              alt=""
              fill
              className="object-cover object-center brightness-[0.35] group-hover:brightness-[0.3] group-hover:scale-105 transition-all duration-500"
              sizes="(max-width: 1152px) 100vw, 1152px"
            />
            <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-accent/25 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:bg-accent/35 transition-colors">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div className="relative z-10 flex-1 min-w-0">
              <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Plan your weekly study schedule</p>
              <p className="text-xs text-white/60 mt-0.5 hidden sm:block">Tell us when and how you study — we&apos;ll find the best rooms and times.</p>
            </div>
            <svg className="relative z-10 w-5 h-5 text-white/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}
      </main>

      {/* Booking Queue FAB */}
      <BookingQueue />

      {/* Footer */}
      <footer className="relative mt-auto overflow-hidden">
        <div className="relative h-32 sm:h-40">
          <Image
            src="/libraries/mchenry-interior.jpg"
            alt="McHenry Library interior"
            fill
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-primary/60" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/40 to-primary/80" />
          <div className="absolute inset-0 flex items-end">
            <div className="w-full py-4">
              <p className="text-center text-xs text-white/50">
                Data sourced from{" "}
                <a
                  href={homePageUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white hover:underline cursor-pointer transition-colors"
                >
                  UCSC Library Room Reservations
                </a>
                . Not affiliated with UC Santa Cruz. Built by&nbsp;
				<a
                  href={'https://rizwaan.dev'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white hover:underline cursor-pointer transition-colors"
                >
                  Rizwaan Bana
                </a>
				.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
