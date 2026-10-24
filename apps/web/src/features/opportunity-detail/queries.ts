"use client";

import {
  contactListSchema,
  opportunitySchema,
  stageHistorySchema,
  type RegisterContactBody,
  type UpdateOpportunityBody,
} from "@nobre/contracts";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import { patchOpportunityCaches } from "../pipeline/queries";

/** Opportunity, stage history and contacts load in parallel and suspend together. */
export function useOpportunityDetail(id: string) {
  const [opportunity, history, contacts] = useSuspenseQueries({
    queries: [
      {
        queryKey: queryKeys.opportunity(id),
        queryFn: ({ signal }) => apiRequest(`/opportunities/${id}`, { schema: opportunitySchema, signal }),
      },
      {
        queryKey: queryKeys.history(id),
        queryFn: ({ signal }) => apiRequest(`/opportunities/${id}/history`, { schema: stageHistorySchema, signal }),
      },
      {
        queryKey: queryKeys.contacts(id),
        queryFn: ({ signal }) => apiRequest(`/opportunities/${id}/contacts`, { schema: contactListSchema, signal }),
      },
    ],
  });
  return { opportunity: opportunity.data, history: history.data.data, contacts: contacts.data.data };
}

export function useRegisterContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterContactBody) =>
      apiRequest(`/opportunities/${id}/contacts`, { method: "POST", schema: opportunitySchema, body }),
    onSuccess: (updated) => {
      patchOpportunityCaches(queryClient, id, () => updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunityLists });
      // Registering a recent contact closes the follow-up reminder on the server.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });
    },
  });
}

export function useUpdateOpportunity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOpportunityBody) =>
      apiRequest(`/opportunities/${id}`, { method: "PATCH", schema: opportunitySchema, body }),
    onSuccess: (updated) => {
      patchOpportunityCaches(queryClient, id, () => updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunityLists });
    },
  });
}
