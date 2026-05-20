import { Room } from "./rooms";

/**
 * Study Planner Algorithm
 *
 * Takes abstract study preferences and scores all possible (date, room, time_block)
 * combinations to produce an optimal weekly booking schedule.
 *
 * Scoring is weighted — preferences influence ranking rather than hard-filter.
 * This lets the algorithm gracefully degrade when perfect matches aren't available.
 */

// ── Types ──

export interface StudyPreferences {
  sessionsPerWeek: number;          // 1–7
  sessionDuration: number;          // minutes (30–240, capped at 240 by policy)
  dayPreferences: DayPreference[];  // which days, empty = flexible
  timePreference: TimePreference;
  groupSize: number;                // 1+ (maps to room capacity)
  locationPreference: "any" | number; // locationId or "any"
  floorPreferences: string[];       // empty = any floor, otherwise only these floors
  roomFilter: "all" | "favorites" | "custom"; // which rooms to consider
  selectedRoomIds: number[];        // manual room picks (used when roomFilter="custom")
  favoriteRoomIds: number[];        // prefer these rooms (scoring bonus)
  schedulingStyle: "spread" | "packed" | "flexible";
  preferSameRoom: boolean;
}

export interface DayPreference {
  day: number; // 0=Sun, 1=Mon, ... 6=Sat
  weight: number; // 0–1, how much they prefer this day (1 = strongly prefer)
}

export interface TimePreference {
  type: "morning" | "afternoon" | "evening" | "custom" | "flexible";
  customStart?: number; // hour (0–23), only for "custom"
  customEnd?: number;   // hour (0–23), only for "custom"
}

export interface SlotInfo {
  start: string;       // "YYYY-MM-DD HH:MM"
  end: string;
  itemId: number;
  checksum: string;
  available: boolean;
  future: boolean;
}

export interface CandidateBlock {
  date: string;          // "YYYY-MM-DD"
  room: Room;
  startTime: string;     // "YYYY-MM-DD HH:MM"
  endTime: string;       // "YYYY-MM-DD HH:MM"
  durationMins: number;
  slots: SlotInfo[];     // individual 30-min slots comprising this block
  score: number;         // 0–100
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  timeMatch: number;      // 0–30  how well the time matches preference
  capacityFit: number;    // 0–15  right-sized room (not too big, not too small)
  roomPreference: number; // 0–20  favorite room bonus
  dayMatch: number;       // 0–20  matches preferred day
  durationFit: number;    // 0–15  block duration matches requested duration
}

export interface ScheduleRecommendation {
  blocks: CandidateBlock[];
  totalScore: number;
  coverageNote: string;   // human-readable note about the recommendation
}

// ── Time Preference Ranges ──

function getPreferredHourRange(pref: TimePreference): [number, number] {
  switch (pref.type) {
    case "morning": return [7, 12];
    case "afternoon": return [12, 17];
    case "evening": return [17, 22];
    case "custom":
      return [pref.customStart ?? 8, pref.customEnd ?? 17];
    case "flexible": return [7, 23];
  }
}

// ── Scoring Functions ──

function scoreTimeMatch(blockStartHour: number, blockEndHour: number, pref: TimePreference): number {
  if (pref.type === "flexible") return 20; // no preference = decent score for all

  const [prefStart, prefEnd] = getPreferredHourRange(pref);
  const prefMid = (prefStart + prefEnd) / 2;
  const blockMid = (blockStartHour + blockEndHour) / 2;

  // Perfect overlap
  if (blockStartHour >= prefStart && blockEndHour <= prefEnd) return 30;

  // Partial overlap
  const overlapStart = Math.max(blockStartHour, prefStart);
  const overlapEnd = Math.min(blockEndHour, prefEnd);
  if (overlapStart < overlapEnd) {
    const overlapPct = (overlapEnd - overlapStart) / (blockEndHour - blockStartHour);
    return Math.round(overlapPct * 25);
  }

  // No overlap — penalize by distance from preferred midpoint
  const dist = Math.abs(blockMid - prefMid);
  return Math.max(0, 15 - dist * 3);
}

function scoreCapacityFit(roomCapacity: number, groupSize: number): number {
  if (roomCapacity < groupSize) return 0; // can't fit — hard zero
  const ratio = groupSize / roomCapacity;
  // Best: 60–100% utilization. Penalize oversized rooms.
  if (ratio >= 0.6) return 15;
  if (ratio >= 0.4) return 12;
  if (ratio >= 0.2) return 8;
  return 5; // very oversized but still usable
}

function scoreRoomPreference(roomId: number, favoriteIds: number[]): number {
  return favoriteIds.includes(roomId) ? 20 : 0;
}

function scoreDayMatch(dayOfWeek: number, dayPrefs: DayPreference[]): number {
  if (dayPrefs.length === 0) return 15; // no preference = moderate score
  const pref = dayPrefs.find((d) => d.day === dayOfWeek);
  if (!pref) return 3; // day not in their list, but don't zero it out
  return Math.round(pref.weight * 20);
}

function scoreDurationFit(blockDurationMins: number, requestedMins: number): number {
  if (blockDurationMins < requestedMins) {
    // Block too short — partial credit based on how much it covers
    return Math.round((blockDurationMins / requestedMins) * 10);
  }
  // Block is long enough
  const excess = blockDurationMins - requestedMins;
  if (excess === 0) return 15; // perfect match
  if (excess <= 30) return 14;
  if (excess <= 60) return 12;
  return 10; // much longer than needed, still fine
}

// ── Block Discovery ──

/** Find consecutive available+future slots for a room on a given date */
function findConsecutiveBlocks(
  roomSlots: SlotInfo[],
  room: Room,
  date: string,
  minDurationMins: number
): { startTime: string; endTime: string; durationMins: number; slots: SlotInfo[] }[] {
  const sorted = roomSlots
    .filter((s) => s.available && s.future)
    .sort((a, b) => a.start.localeCompare(b.start));

  const blocks: { startTime: string; endTime: string; durationMins: number; slots: SlotInfo[] }[] = [];
  let current: SlotInfo[] = [];

  for (const s of sorted) {
    if (current.length === 0) {
      current.push(s);
    } else {
      const lastEnd = current[current.length - 1].end;
      if (s.start === lastEnd) {
        current.push(s);
      } else {
        if (current.length * 30 >= minDurationMins) {
          blocks.push({
            startTime: current[0].start,
            endTime: current[current.length - 1].end,
            durationMins: current.length * 30,
            slots: [...current],
          });
        }
        current = [s];
      }
    }
  }
  if (current.length > 0 && current.length * 30 >= minDurationMins) {
    blocks.push({
      startTime: current[0].start,
      endTime: current[current.length - 1].end,
      durationMins: current.length * 30,
      slots: [...current],
    });
  }

  // For long blocks, also generate sub-windows at each 30-min offset
  // so the algorithm can find the best-scoring time within a long available range
  const expanded: typeof blocks = [];
  const requestedSlots = Math.ceil(minDurationMins / 30);

  for (const block of blocks) {
    if (block.slots.length === requestedSlots) {
      expanded.push(block);
    } else {
      // Sliding window
      for (let i = 0; i <= block.slots.length - requestedSlots; i++) {
        const window = block.slots.slice(i, i + requestedSlots);
        expanded.push({
          startTime: window[0].start,
          endTime: window[window.length - 1].end,
          durationMins: requestedSlots * 30,
          slots: window,
        });
      }
    }
  }

  return expanded;
}

// ── Main Algorithm ──

export interface DayAvailability {
  date: string;
  slots: SlotInfo[];
}

/**
 * Given preferences and multi-day availability data, produce a ranked schedule.
 */
export function generateSchedule(
  prefs: StudyPreferences,
  availability: DayAvailability[],
  rooms: Room[]
): ScheduleRecommendation {
  const cappedDuration = Math.min(prefs.sessionDuration, 240); // 4hr policy cap
  const allCandidates: CandidateBlock[] = [];

  // Build room lookup
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // Filter rooms by hard constraints
  const eligibleRooms = rooms.filter((r) => {
    if (prefs.locationPreference !== "any" && r.locationId !== prefs.locationPreference) return false;
    if (prefs.floorPreferences.length > 0 && !prefs.floorPreferences.includes(r.floor)) return false;
    if (r.capacity < prefs.groupSize) return false;
    // Room filter modes
    if (prefs.roomFilter === "favorites" && !prefs.favoriteRoomIds.includes(r.id)) return false;
    if (prefs.roomFilter === "custom" && prefs.selectedRoomIds.length > 0 && !prefs.selectedRoomIds.includes(r.id)) return false;
    return true;
  });

  const eligibleRoomIds = new Set(eligibleRooms.map((r) => r.id));

  for (const day of availability) {
    const dayDate = new Date(day.date + "T12:00:00");
    const dayOfWeek = dayDate.getDay();

    // Group slots by room
    const byRoom = new Map<number, SlotInfo[]>();
    for (const s of day.slots) {
      if (!eligibleRoomIds.has(s.itemId)) continue;
      const arr = byRoom.get(s.itemId) || [];
      arr.push(s);
      byRoom.set(s.itemId, arr);
    }

    for (const [roomId, roomSlots] of byRoom) {
      const room = roomMap.get(roomId);
      if (!room) continue;

      const blocks = findConsecutiveBlocks(roomSlots, room, day.date, cappedDuration);

      for (const block of blocks) {
        const startHour = parseHour(block.startTime);
        const endHour = parseHour(block.endTime);

        const timeMatch = scoreTimeMatch(startHour, endHour, prefs.timePreference);
        const capacityFit = scoreCapacityFit(room.capacity, prefs.groupSize);
        const roomPreference = scoreRoomPreference(room.id, prefs.favoriteRoomIds);
        const dayMatch = scoreDayMatch(dayOfWeek, prefs.dayPreferences);
        const durationFit = scoreDurationFit(block.durationMins, cappedDuration);

        const breakdown: ScoreBreakdown = {
          timeMatch,
          capacityFit,
          roomPreference,
          dayMatch,
          durationFit,
        };

        const score = timeMatch + capacityFit + roomPreference + dayMatch + durationFit;

        allCandidates.push({
          date: day.date,
          room,
          startTime: block.startTime,
          endTime: block.endTime,
          durationMins: block.durationMins,
          slots: block.slots,
          score,
          scoreBreakdown: breakdown,
        });
      }
    }
  }

  // Select the best combination of N sessions
  const selected = selectOptimalSchedule(allCandidates, prefs);

  // Generate coverage note
  const coverageNote = buildCoverageNote(selected, prefs);

  return {
    blocks: selected,
    totalScore: selected.reduce((sum, b) => sum + b.score, 0),
    coverageNote,
  };
}

/**
 * Greedy selection: pick the best non-conflicting blocks.
 * Respects: one session per day (4hr cap), scheduling style preferences.
 */
function selectOptimalSchedule(
  candidates: CandidateBlock[],
  prefs: StudyPreferences
): CandidateBlock[] {
  if (candidates.length === 0) return [];

  // Apply scheduling style bonus before sorting
  const withStyleBonus = candidates.map((c) => {
    let bonus = 0;
    const dayOfWeek = new Date(c.date + "T12:00:00").getDay();

    if (prefs.schedulingStyle === "packed") {
      // Favor weekdays, earlier in the week
      if (dayOfWeek >= 1 && dayOfWeek <= 5) bonus += 3;
    } else if (prefs.schedulingStyle === "spread") {
      // No explicit bonus here — handled in selection
    }

    return { ...c, score: c.score + bonus };
  });

  // Sort by score descending
  withStyleBonus.sort((a, b) => b.score - a.score);

  const selected: CandidateBlock[] = [];
  const usedDates = new Set<string>();
  const usedRoomDates = new Set<string>(); // "roomId-date"

  for (const candidate of withStyleBonus) {
    if (selected.length >= prefs.sessionsPerWeek) break;

    // One session per day (4hr cap means one meaningful session per day)
    if (usedDates.has(candidate.date)) continue;

    // For "spread" style, try to avoid consecutive days
    if (prefs.schedulingStyle === "spread" && selected.length > 0) {
      const candidateDay = new Date(candidate.date + "T12:00:00");
      const tooClose = selected.some((s) => {
        const sDay = new Date(s.date + "T12:00:00");
        const diffDays = Math.abs(candidateDay.getTime() - sDay.getTime()) / 86400000;
        return diffDays < 2; // avoid consecutive days
      });
      // Soft constraint: skip if we have other options, but accept if running low
      if (tooClose && withStyleBonus.length - selected.length > prefs.sessionsPerWeek - selected.length + 2) {
        continue;
      }
    }

    // For "preferSameRoom", boost candidates in the most-used room
    if (prefs.preferSameRoom && selected.length > 0) {
      const roomCounts = new Map<number, number>();
      selected.forEach((s) => roomCounts.set(s.room.id, (roomCounts.get(s.room.id) || 0) + 1));
      const topRoom = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topRoom && candidate.room.id === topRoom) {
        candidate.score += 10; // same-room bonus
      }
    }

    selected.push(candidate);
    usedDates.add(candidate.date);
    usedRoomDates.add(`${candidate.room.id}-${candidate.date}`);
  }

  // Sort selected by date
  selected.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return selected;
}

function buildCoverageNote(selected: CandidateBlock[], prefs: StudyPreferences): string {
  if (selected.length === 0) {
    return "No matching slots found. Try relaxing your preferences — fewer sessions, different times, or a different building.";
  }

  if (selected.length < prefs.sessionsPerWeek) {
    return `Found ${selected.length} of ${prefs.sessionsPerWeek} requested sessions. Limited availability — consider adjusting your time preferences or checking back later.`;
  }

  const avgScore = Math.round(selected.reduce((s, b) => s + b.score, 0) / selected.length);
  if (avgScore >= 70) {
    return `Great match! Found all ${prefs.sessionsPerWeek} sessions with strong preference alignment.`;
  }
  if (avgScore >= 45) {
    return `Found all ${prefs.sessionsPerWeek} sessions. Some compromises on timing or room choice — review each slot.`;
  }
  return `Found ${prefs.sessionsPerWeek} sessions, but availability is tight. Consider adjusting your preferences for better matches.`;
}

// ── Helpers ──

function parseHour(datetime: string): number {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  return parseInt(h) + parseInt(m) / 60;
}

/** Get dates for the next N days from a start date */
export function getUpcomingDates(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// ── Cram Session (single-day) ──

export interface CramPreferences {
  date: string;
  sessionDuration: number;
  groupSize: number;
  locationPreference: "any" | number;
}

/**
 * Find all bookable blocks for a single day, scored and sorted.
 * Unlike generateSchedule, this returns ALL candidates (not just top-N).
 */
export function generateCramOptions(
  prefs: CramPreferences,
  dayAvailability: DayAvailability,
  rooms: Room[],
  favoriteRoomIds: number[]
): CandidateBlock[] {
  const cappedDuration = Math.min(prefs.sessionDuration, 240);

  const eligibleRooms = rooms.filter((r) => {
    if (prefs.locationPreference !== "any" && r.locationId !== prefs.locationPreference) return false;
    if (r.capacity < prefs.groupSize) return false;
    return true;
  });

  const eligibleRoomIds = new Set(eligibleRooms.map((r) => r.id));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // Group slots by room
  const byRoom = new Map<number, SlotInfo[]>();
  for (const s of dayAvailability.slots) {
    if (!eligibleRoomIds.has(s.itemId)) continue;
    const arr = byRoom.get(s.itemId) || [];
    arr.push(s);
    byRoom.set(s.itemId, arr);
  }

  const candidates: CandidateBlock[] = [];

  for (const [roomId, roomSlots] of byRoom) {
    const room = roomMap.get(roomId);
    if (!room) continue;

    const blocks = findConsecutiveBlocks(roomSlots, room, dayAvailability.date, cappedDuration);

    for (const block of blocks) {
      const startHour = parseHour(block.startTime);
      const endHour = parseHour(block.endTime);

      const timeMatch = 20; // no time preference for cram — neutral score
      const capacityFit = scoreCapacityFit(room.capacity, prefs.groupSize);
      const roomPreference = scoreRoomPreference(room.id, favoriteRoomIds);
      const dayMatch = 15; // single day, always matches
      const durationFit = scoreDurationFit(block.durationMins, cappedDuration);

      const breakdown: ScoreBreakdown = {
        timeMatch,
        capacityFit,
        roomPreference,
        dayMatch,
        durationFit,
      };

      candidates.push({
        date: dayAvailability.date,
        room,
        startTime: block.startTime,
        endTime: block.endTime,
        durationMins: block.durationMins,
        slots: block.slots,
        score: timeMatch + capacityFit + roomPreference + dayMatch + durationFit,
        scoreBreakdown: breakdown,
      });
    }
  }

  // Sort by score desc, then by start time
  candidates.sort((a, b) => b.score - a.score || a.startTime.localeCompare(b.startTime));

  // Deduplicate: for each room, keep only the top-scoring block per start time
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.room.id}-${c.startTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Default preferences for a new planner session */
export function defaultPreferences(): StudyPreferences {
  return {
    sessionsPerWeek: 3,
    sessionDuration: 120,
    dayPreferences: [
      { day: 1, weight: 1 },
      { day: 2, weight: 1 },
      { day: 3, weight: 1 },
      { day: 4, weight: 1 },
      { day: 5, weight: 1 },
    ],
    timePreference: { type: "flexible" },
    groupSize: 1,
    locationPreference: "any",
    floorPreferences: [],
    roomFilter: "all",
    selectedRoomIds: [],
    favoriteRoomIds: [],
    schedulingStyle: "flexible",
    preferSameRoom: false,
  };
}
