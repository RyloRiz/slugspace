/**
 * Centralized URL builders for all outbound UCSC Library links.
 * All links route through /api/book which handles the redirect.
 *
 * Booking links point to the room group's availability page with the date
 * pre-selected. The actual booking requires CruzID login on UCSC's side,
 * so we can only get the user to the right page — they complete the booking there.
 */

function extractHour(datetime: string): number | null {
  const timePart = datetime.split(" ")[1];
  if (!timePart) return null;
  return parseInt(timePart.split(":")[0]);
}

function extractRoomNumber(roomName: string): string | null {
  const match = roomName.match(/\b(\d{3,4})\b/);
  return match ? match[1] : null;
}

export function bookingUrl(
  roomId: number,
  opts?: { start: string; end: string; roomName: string }
): string {
  let url = `/api/book?type=booking&id=${roomId}`;
  if (opts) {
    const hour = extractHour(opts.start);
    const roomNum = extractRoomNumber(opts.roomName);
    if (hour !== null && roomNum) {
      url += `&hour=${hour}&roomNumber=${encodeURIComponent(roomNum)}`;
    }
  }
  return url;
}

export function roomPageUrl(lid: number, gid: number): string {
  return `/api/book?type=room&lid=${lid}&gid=${gid}`;
}

export function homePageUrl(): string {
  return `/api/book?type=home`;
}
