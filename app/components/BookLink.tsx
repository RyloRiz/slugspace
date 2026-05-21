"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

function formatDateNice(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

/* ── Standalone modal ── */

interface BookingDateModalProps {
  open: boolean;
  onClose: () => void;
  href: string;
  slotDate: string;
}

export function BookingDateModal({ open, onClose, href, slotDate }: BookingDateModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-card dark:bg-card-dark shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)]"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label="Booking date warning"
          >
            {/* Top accent band */}
            <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />

            <div className="px-6 pt-5 pb-6">
              {/* Calendar icon + date badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 dark:bg-accent/15">
                  <svg className="h-5 w-5 text-accent-hover dark:text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground leading-tight">
                    {formatWeekday(slotDate)}
                  </p>
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {formatDateNice(slotDate)}
                  </p>
                </div>
              </div>

              {/* Message */}
              <p className="text-[13px] leading-relaxed text-muted">
                The UCSC booking site always opens to <span className="font-medium text-foreground">today&apos;s schedule</span>. To find this slot, you&apos;ll need to:
              </p>

              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-secondary/15 text-[10px] font-bold text-primary-light dark:text-secondary">1</span>
                  <p className="text-[13px] text-muted leading-snug">
                    Switch to <span className="font-medium text-foreground">Week View</span>
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-secondary/15 text-[10px] font-bold text-primary-light dark:text-secondary">2</span>
                  <p className="text-[13px] text-muted leading-snug">
                    Navigate to <span className="font-medium text-foreground">{formatDateNice(slotDate)}</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-border dark:border-border-dark px-4 py-2.5 text-[13px] font-medium text-muted hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-primary dark:bg-secondary px-4 py-2.5 text-[13px] font-semibold text-white text-center hover:bg-primary-hover dark:hover:bg-secondary/80 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  Open UCSC
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── BookLink wrapper ── */

interface BookLinkProps {
  href: string;
  slotDate: string;
  today: string;
  className?: string;
  children?: React.ReactNode;
  onBook?: () => void;
}

export default function BookLink({ href, slotDate, today, className, children, onBook }: BookLinkProps) {
  const [showModal, setShowModal] = useState(false);
  const isToday = slotDate === today;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onBook?.();
      if (!isToday) {
        e.preventDefault();
        setShowModal(true);
      }
    },
    [isToday, onBook]
  );

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>

      <BookingDateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        href={href}
        slotDate={slotDate}
      />
    </>
  );
}
