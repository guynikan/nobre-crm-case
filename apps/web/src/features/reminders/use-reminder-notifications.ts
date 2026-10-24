"use client";

import type { Reminder } from "@nobre/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/shared/ui/toast";

/**
 * Makes the background job noticeable. Reminders raised while the operator is doing
 * something else arrive as a toast, and as a count in the tab title for when that
 * something else is another browser tab.
 *
 * The count is derived from what is open and still unseen rather than accumulated, so
 * a reminder the job closes before anyone looked stops being announced.
 */
export function useReminderNotifications(reminders: Reminder[] | undefined, isPanelOpen: boolean) {
  const toast = useToast();
  // Null until the first fetch: whatever is already open predates this session and is not news.
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null);
  const announcedIds = useRef(new Set<string>());
  const baseTitle = useRef("");

  const idsOf = (list: Reminder[]) => new Set(list.map((reminder) => reminder.id));

  useEffect(() => {
    if (!reminders) return;
    if (seenIds === null) {
      setSeenIds(idsOf(reminders));
      return;
    }
    const fresh = reminders.filter((reminder) => !seenIds.has(reminder.id));
    if (fresh.length === 0) return;
    // Already looking at the list: the arrival is on screen, so it is not news either.
    if (isPanelOpen) {
      setSeenIds(idsOf(reminders));
      return;
    }
    const unannounced = fresh.filter((reminder) => !announcedIds.current.has(reminder.id));
    if (unannounced.length === 0) return;
    for (const reminder of unannounced) announcedIds.current.add(reminder.id);

    const first = unannounced[0]!;
    if (unannounced.length === 1) {
      toast.info("Novo lembrete de follow-up", `${first.opportunityCode} · ${first.companyName}`);
    } else {
      toast.info(`${unannounced.length} novos lembretes de follow-up`, "Abra o sino para ver quais.");
    }
  }, [reminders, seenIds, isPanelOpen, toast]);

  const unseen = reminders && seenIds ? reminders.filter((reminder) => !seenIds.has(reminder.id)).length : 0;

  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    document.title = unseen > 0 ? `(${unseen}) ${baseTitle.current}` : baseTitle.current;
  }, [unseen]);

  // Cleared by looking, not by refocusing the tab: a quiet title on return would hide
  // the very thing the count was raised for.
  const markSeen = useCallback(() => setSeenIds(idsOf(reminders ?? [])), [reminders]);

  return { unseen, markSeen };
}
