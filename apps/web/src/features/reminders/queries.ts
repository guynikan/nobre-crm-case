"use client";

import { followUpRunResultSchema, reminderListSchema, type ReminderStatus } from "@nobre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

export function useReminders(status: ReminderStatus, sellerId?: string) {
  return useQuery({
    queryKey: queryKeys.reminderList(status, sellerId),
    queryFn: ({ signal }) =>
      apiRequest("/reminders", { schema: reminderListSchema, signal, query: { status, sellerId } }),
    select: (list) => list.data,
    placeholderData: keepPreviousData,
    // The cron job creates reminders in the background; keep the badge reasonably fresh.
    refetchInterval: 60_000,
  });
}

/** Runs the same idempotent job the scheduler runs; safe to click twice. */
export function useRunFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("/follow-up/run", { method: "POST", schema: followUpRunResultSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities });
    },
  });
}
