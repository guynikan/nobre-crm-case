"use client";

import { opportunityPageSchema, opportunitySchema, type Opportunity, type OpportunityPage, type Stage } from "@nobre/contracts";
import { evaluateAttentionWithPriority } from "@nobre/domain";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiRequest, errorMessage } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import { useToast } from "@/shared/ui/toast";
import type { OpportunityFilters } from "../filters/use-opportunity-filters";

/** The board shows the whole funnel at once; the API caps a page at 500. */
export const BOARD_PAGE_SIZE = 500;

export function useOpportunityList(filters: OpportunityFilters) {
  return useQuery({
    queryKey: queryKeys.opportunityList(filters),
    queryFn: ({ signal }) =>
      apiRequest("/opportunities", {
        schema: opportunityPageSchema,
        signal,
        query: {
          pageSize: BOARD_PAGE_SIZE,
          search: filters.search || undefined,
          sellerId: filters.sellerId,
          stage: filters.stage,
        },
      }),
    // Keep showing the previous result while a new filter loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

export const MOVE_STAGE_KEY = ["move-stage"] as const;

export interface MoveStageInput {
  opportunity: Opportunity;
  toStage: Stage;
  lostReason?: string;
  today: string;
  thresholdDays: number;
}

/** Writes an updated opportunity into every cached list and its detail entry. */
export function patchOpportunityCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: (current: Opportunity) => Opportunity,
) {
  queryClient.setQueriesData<OpportunityPage>({ queryKey: queryKeys.opportunityLists }, (page) =>
    page ? { ...page, data: page.data.map((item) => (item.id === id ? patch(item) : item)) } : page,
  );
  queryClient.setQueryData<Opportunity>(queryKeys.opportunity(id), (current) => (current ? patch(current) : current));
}

/**
 * Moves a card optimistically: the board updates at once and rolls back if the API refuses.
 * The API remains the authority on every rule; the client only predicts the happy path.
 */
export function useMoveStage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationKey: MOVE_STAGE_KEY,
    mutationFn: ({ opportunity, toStage, lostReason }: MoveStageInput) =>
      apiRequest(`/opportunities/${opportunity.id}/stage`, {
        method: "POST",
        schema: opportunitySchema,
        body: { toStage, expectedVersion: opportunity.version, ...(lostReason ? { lostReason } : {}) },
      }),

    onMutate: async ({ opportunity, toStage, lostReason, today, thresholdDays }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.opportunities });
      const snapshot: [QueryKey, unknown][] = [
        ...queryClient.getQueriesData({ queryKey: queryKeys.opportunityLists }),
        [queryKeys.opportunity(opportunity.id), queryClient.getQueryData(queryKeys.opportunity(opportunity.id))],
      ];
      patchOpportunityCaches(queryClient, opportunity.id, (current) => ({
        ...current,
        stage: toStage,
        lostReason: lostReason ?? null,
        attention: evaluateAttentionWithPriority(
          {
            stage: toStage,
            lastContactOn: current.lastContactOn,
            proposalValidUntil: current.proposalValidUntil,
            eventDate: current.eventDate,
          },
          today,
          thresholdDays,
        ),
      }));
      return { snapshot };
    },

    onError: (error, { opportunity }, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
      const { title, detail } = errorMessage(error);
      toast.error(`${opportunity.code}: ${title}`, detail ?? "O card voltou para a etapa anterior.");
    },

    onSuccess: (updated) => {
      patchOpportunityCaches(queryClient, updated.id, () => updated);
    },

    onSettled: (_data, _error, { opportunity }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunityLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.history(opportunity.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });
    },
  });
}
