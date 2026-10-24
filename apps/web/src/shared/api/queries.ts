import { appMetaSchema, sellerListSchema } from "@nobre/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./client";
import { queryKeys } from "./query-keys";

/** Business "today" and thresholds come from the API so the UI never disagrees with the rules. */
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: ({ signal }) => apiRequest("/meta", { schema: appMetaSchema, signal }),
    staleTime: 5 * 60_000,
  });
}

export function useSellers() {
  return useQuery({
    queryKey: queryKeys.sellers,
    queryFn: ({ signal }) => apiRequest("/sellers", { schema: sellerListSchema, signal }),
    staleTime: 5 * 60_000,
    select: (list) => list.data,
  });
}
