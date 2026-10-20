import type { ReminderStatus } from "@nobre/contracts";
import type { OpportunityFilters } from "@/features/filters/use-opportunity-filters";

/** Every query key in one place, so invalidation after a mutation stays correct. */
export const queryKeys = {
  meta: ["meta"] as const,
  sellers: ["sellers"] as const,
  opportunities: ["opportunities"] as const,
  opportunityLists: ["opportunities", "list"] as const,
  opportunityList: (filters: OpportunityFilters) => ["opportunities", "list", filters] as const,
  opportunity: (id: string) => ["opportunities", "detail", id] as const,
  history: (id: string) => ["opportunities", "detail", id, "history"] as const,
  contacts: (id: string) => ["opportunities", "detail", id, "contacts"] as const,
  reminders: ["reminders"] as const,
  reminderList: (status: ReminderStatus, sellerId?: string) => ["reminders", status, sellerId ?? "all"] as const,
};
