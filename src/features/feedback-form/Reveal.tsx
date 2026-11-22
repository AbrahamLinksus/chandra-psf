import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CLOSE_MS = 300;

export interface RevealProps<T> {
  open: boolean;
  /** what the content shows; the last value seen while open is kept during the close animation */
  value: T;
  children: (value: T) => ReactNode;
  /** where focus goes if it was inside the content when it collapses (the control that caused it) */
  returnFocusTo?: () => HTMLElement | null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Tracks whether focus is inside the content; when it collapses with focus in, focus moves to the trigger. */
function useReturnFocus(open: boolean, target: (() => HTMLElement | null) | undefined) {
  const inside = useRef(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open && inside.current) {
      inside.current = false;
      target?.()?.focus();
    }
    wasOpen.current = open;
  }, [open, target]);
  return {
    onFocus: () => {
      inside.current = true;
    },
    onBlur: () => {
      inside.current = false;
    },
  };
}

/** Mount state: mounted while open and through the close animation (none under reduced motion). */
function useMounted(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);
  if (!open && mounted && prefersReducedMotion()) {
    setMounted(false);
    setEntered(false);
  }

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => {
        setEntered(true);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    const timer = setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, CLOSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [open]);
  return { mounted, entered };
}

/**
 * Slides its content open and closed (grid-rows 0fr/1fr). Closed content is unmounted after the
 * animation; while closing it is inert and hidden from assistive tech. No motion for
 * prefers-reduced-motion.
 */
export function Reveal<T>({ open, value, children, returnFocusTo }: RevealProps<T>) {
  const [snapshot, setSnapshot] = useState(value);
  if (open && snapshot !== value) setSnapshot(value);
  const { mounted, entered } = useMounted(open);
  const focus = useReturnFocus(open, returnFocusTo);

  if (!open && !mounted) return null;
  return (
    <div
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none",
        open && entered ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children(open ? value : snapshot)}</div>
    </div>
  );
}
