import type { SlotData } from "../components/TimeGrid";

/**
 * Returns true if the slot is in the future (bookable).
 * For dates other than today, all slots are considered future.
 */
export function isSlotFuture(slot: SlotData, today: string): boolean {
  if (!slot.start.startsWith(today)) return true;
  const now = new Date();
  const slotTime = new Date(slot.start.replace(" ", "T"));
  return slotTime > now;
}

/**
 * A slot is available when the API returns NO className.
 * When className is present (e.g. "s-lc-eq-checkout"), the slot is booked.
 * This matches the UCSC site's own JS: className → unavailable, no className → available.
 */
export function isSlotAvailable(slot: SlotData): boolean {
  return !slot.className;
}

export function isSlotBookable(slot: SlotData, today: string): boolean {
  return isSlotAvailable(slot) && isSlotFuture(slot, today);
}
