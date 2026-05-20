# UCSC Room Booker

A Swiss Army knife room booking tool for UC Santa Cruz students. View real-time study room availability across both McHenry Library and the Science & Engineering Library, filter by floor/capacity, and jump straight to booking.

## Features

- **Real-time availability** — Fetches live data from the UCSC Library reservation system
- **Card view** — Room cards showing available time blocks, longest consecutive slot, and capacity
- **Grid view** — Timeline grid showing 30-minute slot availability across all rooms
- **Smart filters** — Filter by floor, minimum capacity, or available-only rooms
- **Direct booking links** — Click any available slot to open the UCSC booking page
- **Auto-refresh** — Refreshes every 2 minutes to stay current
- **Date navigation** — Browse availability for any date

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- `app/api/availability/route.ts` — API proxy to the UCSC Library SpringShare availability endpoint
- `app/lib/rooms.ts` — Static room metadata (IDs, names, floors, capacities)
- `app/components/BookingDashboard.tsx` — Main dashboard with date navigation, filters, view toggle
- `app/components/TimeGrid.tsx` — Grid view with per-room timeline
- `app/components/RoomCards.tsx` — Card view with availability blocks
- `app/components/QuickStats.tsx` — Summary statistics bar

## Room Data

### McHenry Library

| Category                     | Spaces | Floors         |
| ---------------------------- | ------ | -------------- |
| Study Rooms                  | 38     | Ground-4th     |
| Digital Scholarship Commons  | 4      | Ground         |
| Keyboard Room                | 1      | Ground         |

### Science & Engineering Library

| Category                     | Spaces | Floors         |
| ---------------------------- | ------ | -------------- |
| Study Rooms                  | 16     | 1st, 3rd       |
| Innovation Studio (equipment)| 12     | Lower          |

## Note on Booking Identity

The UCSC Library API does **not** expose who booked a room. The API response only contains:

- Time slots with `className: "s-lc-eq-checkout"` (available) or no className (booked)
- A `bookings` array that is always empty for unauthenticated requests
- No patron names, emails, or identifiers are returned

This is by design — the system (SpringShare LibCal) protects user privacy. The `patronHash` variable exists in the page JavaScript but is only populated for authenticated sessions viewing their own bookings. There is no public endpoint to see who booked a given room.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript
