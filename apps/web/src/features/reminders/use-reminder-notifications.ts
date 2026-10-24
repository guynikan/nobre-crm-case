"use client";

import type { Reminder } from "@nobre/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/shared/ui/toast";

/**
 * Makes the background job noticeable. The reminders the scheduler raises while the
 * operator is doing something else arrive as a toast, and as a count in the tab title
 * for when that something else is another browser tab.
 */
export function useReminderNotifications(reminders: Reminder[] | undefined) {
  const toast = useToast();
  // Null until the first fetch: whatever is already open predates this session and is not news.
  const seenIds = useRef<Set<string> | null>(null);
  const baseTitle = useRef("");
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    if (!reminders) return;
    const ids = new Set(reminders.map((reminder) => reminder.id));
    if (seenIds.current === null) {
      seenIds.current = ids;
      return;
    }
    const fresh = reminders.filter((reminder) => !seenIds.current?.has(reminder.id));
    seenIds.current = ids;
    if (fresh.length === 0) return;

    setUnseen((count) => count + fresh.length);
    const first = fresh[0]!;
    if (fresh.length === 1) {
      toast.info("Novo lembrete de follow-up", `${first.opportunityCode} · ${first.companyName}`);
    } else {
      toast.info(`${fresh.length} novos lembretes de follow-up`, "Abra o sino para ver quais.");
    }
  }, [reminders, toast]);

  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    document.title = unseen > 0 ? `(${unseen}) ${baseTitle.current}` : baseTitle.current;
  }, [unseen]);

  // The count is cleared by looking, not by coming back to the tab: returning to a quiet
  // title would hide the very thing it was raised for.
  const markSeen = useCallback(() => setUnseen(0), []);

  return { unseen, markSeen };
}
