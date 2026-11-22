import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CLOSE_MS = 300;

export interface RevealProps<T> {
  open: boolean;
  /** what the content shows; the last value seen while open is kept during the close animation */
  value: T;
  children: (value: T) => ReactNode;
}

/**
 * Slides its content open and closed (grid-rows 0fr/1fr). Closed content is unmounted after the
 * animation; while closing it is inert and hidden from assistive tech. No motion for
 * prefers-reduced-motion.
 */
export function Reveal<T>({ open, value, children }: RevealProps<T>) {
  const [snapshot, setSnapshot] = useState(value);
  if (open && snapshot !== value) setSnapshot(value);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);

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

  if (!open && !mounted) return null;
  return (
    <div
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
