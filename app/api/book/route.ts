import { NextRequest, NextResponse } from "next/server";

const UCSC_BASE = "https://calendar.library.ucsc.edu";

/**
 * Centralized redirect endpoint for all outbound links to UCSC Library.
 *
 * Query params:
 *   type=booking  → Room group availability page with date pre-selected
 *     lid, gid, date (all required)
 *     Users land on the right page, log in with CruzID, and book from there.
 *
 *   type=room     → View a room/space group page
 *     lid, gid (all required)
 *
 *   type=home     → UCSC Library spaces homepage
 *     (no extra params)
 *
 * This single endpoint lets us:
 *   1. Track analytics (log redirects, count bookings, etc.)
 *   2. Change UCSC URLs in one place if their system changes
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");

  let destination: string;

  switch (type) {
    case "booking": {
      const id = params.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "Missing required param: id" },
          { status: 400 }
        );
      }

      destination = `${UCSC_BASE}/space/${id}#eq-time-grid`;
      const hourParam = params.get("hour");
      const roomNumber = params.get("roomNumber");
      if (hourParam !== null) {
        const hour = parseInt(hourParam);
        const fmt = (h: number) => {
          const ampm = h >= 12 ? "pm" : "am";
          const d = h > 12 ? h - 12 : h === 0 ? 12 : h;
          return `${d}%3A00${ampm}`;
        };
        const target = fmt(hour);
        let prefix: string;
        let suffix: string;
        if (hour === 0) {
          // 12:00am — first hour, "Space" precedes it on the page
          prefix = "Space";
          suffix = fmt(1);
        } else if (hour === 23) {
          // 11:00pm — last hour, room info follows it on the page
          prefix = fmt(22);
          suffix = `Room%20${roomNumber}%20(Capacity`;
        } else {
          prefix = fmt(hour - 1);
          suffix = fmt(hour + 1);
        }
        destination += `:~:text=${prefix}-,${target},-${suffix}`;
      }
      break;
    }

    case "room": {
      const lid = params.get("lid");
      const gid = params.get("gid");

      if (!lid || !gid) {
        return NextResponse.json(
          { error: "Missing required params: lid, gid" },
          { status: 400 }
        );
      }

      destination = `${UCSC_BASE}/spaces?lid=${lid}&gid=${gid}`;
      break;
    }

    case "home":
      destination = `${UCSC_BASE}/spaces`;
      break;

    default:
      return NextResponse.json(
        { error: "Invalid type. Use: booking, room, or home" },
        { status: 400 }
      );
  }

  // ── Analytics hook ──
  // Future: log to your analytics provider here.
  // e.g. await analytics.track("outbound_redirect", { type, destination, ... });

  return NextResponse.redirect(destination);
}
