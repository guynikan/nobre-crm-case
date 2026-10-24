"use client";

import { stageSchema, type Stage } from "@nobre/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

/** Filters live in the URL: they survive reloads and can be shared with a colleague. */
export interface OpportunityFilters {
  search: string;
  sellerId: string | undefined;
  stage: Stage | undefined;
}

export type BoardView = "board" | "list";

/** URL parameter names. */
const PARAM = {
  search: "q",
  sellerId: "seller",
  stage: "stage",
  view: "view",
  opportunity: "opportunity",
} as const;

export type UrlPatch = Partial<Record<keyof typeof PARAM, string | null>>;

export function useOpportunityFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const view: BoardView = params.get(PARAM.view) === "list" ? "list" : "board";
  const filters = useMemo<OpportunityFilters>(() => {
    const stage = stageSchema.safeParse(params.get(PARAM.stage));
    return {
      search: params.get(PARAM.search)?.trim() ?? "",
      sellerId: params.get(PARAM.sellerId) || undefined,
      // The stage filter only makes sense in the list: the board already splits by stage.
      stage: view === "list" && stage.success ? stage.data : undefined,
    };
  }, [params, view]);

  const update = useCallback(
    (patch: UrlPatch) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch) as [keyof typeof PARAM, string | null][]) {
        if (value === null || value === "") next.delete(PARAM[key]);
        else next.set(PARAM[key], value);
      }
      const query = next.toString();
      // A transition keeps the current board interactive while the new filter renders.
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  const hasActiveFilters = filters.search !== "" || !!filters.sellerId || !!filters.stage;

  return {
    filters,
    view,
    openOpportunityId: params.get(PARAM.opportunity),
    update,
    isPending,
    hasActiveFilters,
  };
}
