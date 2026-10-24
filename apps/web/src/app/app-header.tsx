"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReminders } from "@/features/reminders/queries";
import { RemindersHub } from "@/features/reminders/reminders-hub";
import { useReminderNotifications } from "@/features/reminders/use-reminder-notifications";
import { useMeta } from "@/shared/api/queries";
import { formatDate } from "@/shared/format";

export function AppHeader() {
  const meta = useMeta();
  const reminders = useReminders("OPEN");
  const openCount = reminders.data?.length ?? 0;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusOnClose = useRef(true);
  const { markSeen } = useReminderNotifications(reminders.data, isOpen);

  function open() {
    restoreFocusOnClose.current = true;
    setIsOpen(true);
    markSeen();
  }

  useEffect(() => {
    if (!isOpen) return;
    const focusFrame = requestAnimationFrame(() => {
      const initialFocus = dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      (initialFocus ?? dialogRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreFocusOnClose.current = true;
        setIsOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        restoreFocusOnClose.current = false;
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      if (restoreFocusOnClose.current) triggerRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <header className="flex h-11 items-center justify-between bg-nobre-900 px-6 text-white">
      <Link href="/" className="font-semibold tracking-tight">
        Nobre <span className="font-normal text-nobre-100/70">CRM</span>
      </Link>

      <div className="flex items-center gap-5">
        {meta.data ? (
          <p className="text-sm text-nobre-100/80">
            Hoje: <span className="font-mono text-white">{formatDate(meta.data.today)}</span>
          </p>
        ) : null}

        <div className="relative" ref={containerRef}>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label={
              openCount > 0 ? `Lembretes de follow-up: ${openCount} em aberto` : "Lembretes de follow-up"
            }
            onClick={() => {
              if (isOpen) {
                restoreFocusOnClose.current = true;
                setIsOpen(false);
              } else {
                open();
              }
            }}
            className={`relative rounded-md p-2 transition hover:bg-white/10 ${isOpen ? "bg-white/15" : ""}`}
          >
            <BellIcon />
            {openCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-alert-600 px-1 text-center font-mono text-[11px] leading-4.5 text-white">
                {openCount}
              </span>
            ) : null}
          </button>

          {isOpen ? (
            <div
              ref={dialogRef}
              role="dialog"
              aria-label="Lembretes de follow-up"
              tabIndex={-1}
              className="absolute right-0 z-40 mt-2 overflow-hidden rounded-lg border border-line bg-panel shadow-xl"
            >
              <RemindersHub
                onNavigate={() => {
                  restoreFocusOnClose.current = false;
                  setIsOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8.4A6 6 0 1 0 6 8.4c0 5.2-2 6.6-2 6.6h16s-2-1.4-2-6.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
