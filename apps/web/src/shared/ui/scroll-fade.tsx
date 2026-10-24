"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Horizontal scroller that fades only the edges still hiding content. */
export function ScrollFade({
  className = "",
  contentClassName = "",
  contentKey,
  children,
}: {
  className?: string;
  contentClassName?: string;
  /** Change it whenever the content width may have changed, so the edges are measured again. */
  contentKey?: unknown;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    // Content can change scrollWidth without resizing the scroller itself, hence contentKey.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, contentKey]);

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollRef} onScroll={measure} className={`overflow-x-auto ${contentClassName}`}>
        {children}
      </div>
      <EdgeFade side="left" visible={edges.left} />
      <EdgeFade side="right" visible={edges.right} />
    </div>
  );
}

function EdgeFade({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  const position = side === "left" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 w-12 from-paper to-transparent transition-opacity duration-200 ${position} ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}
