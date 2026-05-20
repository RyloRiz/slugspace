/**
 * Centralized URL builders for all outbound UCSC Library links.
 * All links route through /api/book which handles the redirect.
 *
 * Booking links point to the room group's availability page with the date
 * pre-selected. The actual booking requires CruzID login on UCSC's side,
 * so we can only get the user to the right page — they complete the booking there.
 */

export function bookingUrl(roomId: number): string {
  return `/api/book?type=booking&id=${roomId}`;
}

export function roomPageUrl(lid: number, gid: number): string {
  return `/api/book?type=room&lid=${lid}&gid=${gid}`;
}

export function homePageUrl(): string {
  return `/api/book?type=home`;
}
