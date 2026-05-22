"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface CollapsibleProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Smooth height animation using CSS grid trick (0fr → 1fr).
 * Content is fully removed from layout when closed, but animates smoothly.
 */
export default function Collapsible({ open, children, className = "" }: CollapsibleProps) {
  const [shouldRender, setShouldRender] = useState(open);
  // animateOpen lags one frame behind so the DOM renders at 0fr first
  const [animateOpen, setAnimateOpen] = useState(open);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Force a frame at 0fr before transitioning to 1fr
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateOpen(true);
        });
      });
    } else {
      setAnimateOpen(false);
    }
  }, [open]);

  const handleTransitionEnd = useCallback(() => {
    if (!open) {
      setShouldRender(false);
    }
  }, [open]);

  if (!shouldRender && !open) return null;

  return (
    <div
      ref={ref}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        animateOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
