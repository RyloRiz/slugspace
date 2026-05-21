"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useBookingQueue, QueuedSlot } from "../lib/booking-queue";
import { motion, AnimatePresence } from "motion/react";

function formatTime(datetime: string): string {
  const time = datetime.split(" ")[1];
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function BookingQueue() {
  const { queue, count, removeSlot, clearQueue } = useBookingQueue();
  const [expanded, setExpanded] = useState(false);
  const [bookingMode, setBookingMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Client mount check for portal
  if (!mounted && typeof window !== "undefined") {
    setMounted(true);
  }

  if (count === 0) return null;

  const startBooking = () => {
    setBookingMode(true);
    setCurrentIdx(0);
  };

  const openCurrentAndAdvance = () => {
    const slot = queue[currentIdx];
    if (slot) {
      window.open(slot.bookingUrl, "_blank", "noopener,noreferrer");
      if (currentIdx < queue.length - 1) {
        setCurrentIdx(currentIdx + 1);
      } else {
        // All done
        setBookingMode(false);
        clearQueue();
      }
    }
  };

  const fab = (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2 }}
          className="fixed bottom-5 right-5 z-50"
        >
          {/* Expanded panel */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="mb-3 w-80 sm:w-96 rounded-2xl bg-card dark:bg-card-dark border border-border dark:border-border-dark shadow-2xl shadow-black/20 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-border dark:border-border-dark flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    Booking Queue
                    <span className="text-muted font-normal ml-1.5">({count})</span>
                  </h3>
                  <button
                    onClick={clearQueue}
                    className="text-[11px] text-booked hover:text-booked/80 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>

                {/* Booking flow mode */}
                {bookingMode ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                        Booking {currentIdx + 1} of {queue.length}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${((currentIdx + 1) / queue.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {queue[currentIdx] && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-sm font-semibold text-foreground">{queue[currentIdx].roomName}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatDateShort(queue[currentIdx].date)} &middot; {formatTime(queue[currentIdx].start)} – {formatTime(queue[currentIdx].end)}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setBookingMode(false); setCurrentIdx(0); }}
                        className="flex-1 py-2.5 rounded-xl border border-border dark:border-border-dark text-xs font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={openCurrentAndAdvance}
                        className="flex-1 py-2.5 rounded-xl bg-available text-white text-xs font-bold hover:bg-green-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {currentIdx < queue.length - 1 ? (
                          <>
                            Book & Next
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </>
                        ) : (
                          <>
                            Book Last
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted text-center">
                      Each click opens a new tab to the UCSC booking page. Complete the booking, then come back for the next.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Queue list */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-border/50 dark:divide-border-dark/50">
                      {queue.map((slot, idx) => (
                        <div key={slot.id} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="w-5 h-5 rounded-md bg-primary/10 dark:bg-secondary/10 text-primary dark:text-secondary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{slot.roomName}</p>
                            <p className="text-[10px] text-muted">
                              {formatDateShort(slot.date)} &middot; {formatTime(slot.start)} – {formatTime(slot.end)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeSlot(slot.id)}
                            className="p-1 text-muted hover:text-booked transition-colors cursor-pointer shrink-0"
                            aria-label="Remove from queue"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Book all button */}
                    <div className="p-3 border-t border-border dark:border-border-dark">
                      <button
                        onClick={startBooking}
                        className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-light transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        Book All ({count})
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* FAB button */}
          <button
            onClick={() => { setExpanded(!expanded); if (bookingMode) { setBookingMode(false); setCurrentIdx(0); } }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary-light active:scale-[0.97] transition-all cursor-pointer"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Queue ({count})
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(fab, document.body);
}
