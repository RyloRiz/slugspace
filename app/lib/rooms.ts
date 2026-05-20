export interface Room {
  id: number;
  name: string;
  floor: string;
  capacity: number;
  features: string[];
  locationId: number;
  groupId: number;
}

export interface Location {
  id: number;
  name: string;
  shortName: string;
  groups: Group[];
}

export interface Group {
  id: number;
  name: string;
}

export const LOCATIONS: Location[] = [
  {
    id: 16578,
    name: "Science & Engineering Library",
    shortName: "S&E Library",
    groups: [
      { id: 34972, name: "Study Rooms" },
      { id: 34976, name: "Innovation Studio" },
    ],
  },
  {
    id: 16577,
    name: "McHenry Library",
    shortName: "McHenry",
    groups: [
      { id: 34977, name: "Study Rooms" },
      { id: 34974, name: "Digital Scholarship Commons" },
      { id: 35241, name: "Keyboard Room" },
    ],
  },
];

// Mapping verified from UCSC Library resourceNameIdMap
export const ROOMS: Room[] = [
  // ── McHenry Library: Study Rooms (lid=16577, gid=34977) ──
  // 2nd Floor
  { id: 139545, name: "Room 2316 - Presentation Practice", floor: "2nd", capacity: 6, features: ["Presentation"], locationId: 16577, groupId: 34977 },
  { id: 139546, name: "Room 2351", floor: "2nd", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139548, name: "Room 2353 (Large)", floor: "2nd", capacity: 30, features: [], locationId: 16577, groupId: 34977 },
  // 3rd Floor
  { id: 139549, name: "Room 3360", floor: "3rd", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139550, name: "Room 3362", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139551, name: "Room 3364", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139552, name: "Room 3366", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139553, name: "Room 3368", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139554, name: "Room 3370", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139555, name: "Room 3372", floor: "3rd", capacity: 7, features: [], locationId: 16577, groupId: 34977 },
  { id: 139556, name: "Room 3374", floor: "3rd", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139557, name: "Room 3376", floor: "3rd", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  // 4th Floor
  { id: 139536, name: "Room 4360", floor: "4th", capacity: 10, features: [], locationId: 16577, groupId: 34977 },
  { id: 139537, name: "Room 4362", floor: "4th", capacity: 10, features: [], locationId: 16577, groupId: 34977 },
  { id: 139538, name: "Room 4364 - media:scape", floor: "4th", capacity: 7, features: ["media:scape"], locationId: 16577, groupId: 34977 },
  { id: 139539, name: "Room 4366", floor: "4th", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139540, name: "Room 4368", floor: "4th", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139541, name: "Room 4370", floor: "4th", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139542, name: "Room 4372", floor: "4th", capacity: 10, features: [], locationId: 16577, groupId: 34977 },
  { id: 139543, name: "Room 4374", floor: "4th", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139544, name: "Room 4376", floor: "4th", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  // Ground Floor
  { id: 139576, name: "Room 0331", floor: "Ground", capacity: 14, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139575, name: "Room 0332", floor: "Ground", capacity: 14, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139573, name: "Room 0334", floor: "Ground", capacity: 12, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139572, name: "Room 0335", floor: "Ground", capacity: 12, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139571, name: "Room 0336", floor: "Ground", capacity: 10, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139570, name: "Room 0337", floor: "Ground", capacity: 2, features: [], locationId: 16577, groupId: 34977 },
  { id: 139569, name: "Room 0338", floor: "Ground", capacity: 10, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139568, name: "Room 0339", floor: "Ground", capacity: 4, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139567, name: "Room 0340", floor: "Ground", capacity: 3, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139566, name: "Room 0341", floor: "Ground", capacity: 4, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139565, name: "Room 0342", floor: "Ground", capacity: 4, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139564, name: "Room 0343", floor: "Ground", capacity: 6, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139563, name: "Room 0344", floor: "Ground", capacity: 4, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139562, name: "Room 0345 (Large)", floor: "Ground", capacity: 20, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139561, name: "Room 0346", floor: "Ground", capacity: 8, features: ["Media"], locationId: 16577, groupId: 34977 },
  { id: 139559, name: "Room 0351", floor: "Ground", capacity: 6, features: [], locationId: 16577, groupId: 34977 },
  { id: 139558, name: "Room 0359", floor: "Ground", capacity: 8, features: ["Media"], locationId: 16577, groupId: 34977 },

  // ── McHenry Library: Digital Scholarship Commons (lid=16577, gid=34974) ──
  { id: 139591, name: "DSC Lab: Meeting Table", floor: "Ground", capacity: 10, features: ["Not a private room"], locationId: 16577, groupId: 34974 },
  { id: 139592, name: "DSC Lab: Computer Table 1", floor: "Ground", capacity: 4, features: [], locationId: 16577, groupId: 34974 },
  { id: 139593, name: "DSC Lab: Computer Table 2", floor: "Ground", capacity: 4, features: [], locationId: 16577, groupId: 34974 },
  { id: 139594, name: "Flatbed Scanner Station", floor: "Ground", capacity: 2, features: ["Scanner"], locationId: 16577, groupId: 34974 },

  // ── McHenry Library: Keyboard Room (lid=16577, gid=35241) ──
  { id: 139574, name: "Music Keyboard (Room 0333)", floor: "Ground", capacity: 1, features: ["Keyboard"], locationId: 16577, groupId: 35241 },

  // ── Science & Engineering Library: Study Rooms (lid=16578, gid=34972) ──
  // 1st Floor
  { id: 140744, name: "Room 115", floor: "1st", capacity: 6, features: [], locationId: 16578, groupId: 34972 },
  { id: 140745, name: "Room 116", floor: "1st", capacity: 6, features: [], locationId: 16578, groupId: 34972 },
  { id: 140746, name: "Room 117", floor: "1st", capacity: 6, features: [], locationId: 16578, groupId: 34972 },
  { id: 140747, name: "Room 118", floor: "1st", capacity: 6, features: [], locationId: 16578, groupId: 34972 },
  { id: 139577, name: "Room 135", floor: "1st", capacity: 5, features: [], locationId: 16578, groupId: 34972 },
  { id: 139578, name: "Room 137", floor: "1st", capacity: 7, features: [], locationId: 16578, groupId: 34972 },
  { id: 139579, name: "Room 138", floor: "1st", capacity: 6, features: [], locationId: 16578, groupId: 34972 },
  { id: 139580, name: "Room 139", floor: "1st", capacity: 5, features: [], locationId: 16578, groupId: 34972 },
  // 3rd Floor
  { id: 139581, name: "Room 308", floor: "3rd", capacity: 4, features: [], locationId: 16578, groupId: 34972 },
  { id: 139582, name: "Room 309", floor: "3rd", capacity: 9, features: [], locationId: 16578, groupId: 34972 },
  { id: 139583, name: "Room 310", floor: "3rd", capacity: 4, features: [], locationId: 16578, groupId: 34972 },
  { id: 139584, name: "Room 324", floor: "3rd", capacity: 8, features: [], locationId: 16578, groupId: 34972 },
  { id: 139585, name: "Room 326", floor: "3rd", capacity: 8, features: [], locationId: 16578, groupId: 34972 },
  { id: 139586, name: "Room 328", floor: "3rd", capacity: 8, features: [], locationId: 16578, groupId: 34972 },
  { id: 139587, name: "Room 330", floor: "3rd", capacity: 8, features: [], locationId: 16578, groupId: 34972 },
  { id: 139588, name: "Room 332", floor: "3rd", capacity: 15, features: [], locationId: 16578, groupId: 34972 },

  // ── S&E Library: Innovation Studio (lid=16578, gid=34976) ──
  { id: 164304, name: "3D Printer - Bambu #1", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 140287, name: "3D Printer - Bambu #2", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 164305, name: "3D Printer - Bambu #3", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 164306, name: "3D Printer - Bambu #4", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 140285, name: "3D Printer - Bambu #5", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 140286, name: "3D Printer - Bambu #6", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 140288, name: "3D Printer - Bambu #7", floor: "Lower", capacity: 1, features: ["3D Printer"], locationId: 16578, groupId: 34976 },
  { id: 140295, name: "Cricut #1", floor: "Lower", capacity: 1, features: ["Cricut"], locationId: 16578, groupId: 34976 },
  { id: 140296, name: "Cricut #2", floor: "Lower", capacity: 1, features: ["Cricut"], locationId: 16578, groupId: 34976 },
  { id: 140298, name: "Cricut #4", floor: "Lower", capacity: 1, features: ["Cricut"], locationId: 16578, groupId: 34976 },
  { id: 140294, name: "Glowforge #1", floor: "Lower", capacity: 1, features: ["Laser Cutter"], locationId: 16578, groupId: 34976 },
  { id: 140293, name: "Glowforge #3", floor: "Lower", capacity: 1, features: ["Laser Cutter"], locationId: 16578, groupId: 34976 },
];

export function getFloorsForSelection(locationId: number, groupId: number): string[] {
  const floors = new Set(
    ROOMS
      .filter((r) => r.locationId === locationId && r.groupId === groupId)
      .map((r) => r.floor)
  );
  return Array.from(floors);
}

export function getRoomsForSelection(locationId: number, groupId: number): Room[] {
  return ROOMS.filter((r) => r.locationId === locationId && r.groupId === groupId);
}

export function getRoomById(id: number): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}
