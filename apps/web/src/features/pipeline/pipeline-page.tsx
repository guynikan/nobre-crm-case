"use client";

import { lazy, Suspense, useDeferredValue } from "react";
import { errorMessage } from "@/shared/api/client";
import { useMeta } from "@/shared/api/queries";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/shared/ui/states";
import { FilterBar } from "../filters/filter-bar";
import { useOpportunityFilters } from "../filters/use-opportunity-filters";
import { DetailSkeleton } from "../opportunity-detail/detail-skeleton";
import { BOARD_PAGE_SIZE, useOpportunityList } from "./queries";
import { PipelineBoard } from "./board";
import { OpportunityTable } from "./opportunity-table";

// The detail drawer is only downloaded when a seller opens an opportunity.
const OpportunityDetail = lazy(() => import("../opportunity-detail/opportunity-detail"));

export function PipelinePage() {
  const { filters, view, openOpportunityId, update, isPending, hasActiveFilters } = useOpportunityFilters();
  // Rendering the board is the expensive part; deferring the filters keeps the inputs responsive.
  const deferredFilters = useDeferredValue(filters);
  const isStale = deferredFilters !== filters || isPending;

  const meta = useMeta();
  const list = useOpportunityList(deferredFilters);
  // Same query the "attention" toggle would run, so its badge always matches the board.
  const attention = useOpportunityList({ ...deferredFilters, needsAttention: true, stage: undefined });

  const open = (id: string) => update({ opportunity: id });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="space-y-3 px-6 py-4">
        <FilterBar
          filters={filters}
          view={view}
          update={update}
          hasActiveFilters={hasActiveFilters}
          attentionTotal={attention.data?.total}
        />
        <div className="flex h-5 items-center gap-3 text-sm text-muted" aria-live="polite">
          {list.data ? (
            <span>
              {list.data.total === 1 ? "1 oportunidade" : `${list.data.total} oportunidades`}
              {list.data.total > BOARD_PAGE_SIZE ? ` (exibindo as ${BOARD_PAGE_SIZE} mais urgentes)` : ""}
            </span>
          ) : null}
          {isStale || list.isFetching ? <Spinner label="Atualizando" /> : null}
        </div>
      </div>

      {meta.isError || list.isError ? (
        <div className="px-6">
          <ErrorState
            {...errorMessage(meta.error ?? list.error)}
            onRetry={() => {
              void meta.refetch();
              void list.refetch();
            }}
          />
        </div>
      ) : !meta.data || !list.data ? (
        <BoardSkeleton />
      ) : list.data.data.length === 0 ? (
        <div className="px-6">
          <EmptyState title={hasActiveFilters ? "Nenhuma oportunidade com esses filtros" : "Nenhuma oportunidade cadastrada"}>
            {hasActiveFilters ? "Ajuste a busca ou limpe os filtros para ver o funil completo." : "Rode o seed do banco (pnpm db:seed)."}
          </EmptyState>
        </div>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col transition-opacity ${isStale ? "opacity-60" : ""}`}>
          {view === "board" ? (
            <PipelineBoard
              opportunities={list.data.data}
              today={meta.data.today}
              thresholdDays={meta.data.attentionThresholdDays}
              onOpen={open}
            />
          ) : (
            <OpportunityTable opportunities={list.data.data} today={meta.data.today} onOpen={open} />
          )}
        </div>
      )}

      {openOpportunityId && meta.data ? (
        <Suspense fallback={<DetailSkeleton />}>
          <OpportunityDetail id={openOpportunityId} meta={meta.data} onClose={() => update({ opportunity: null })} />
        </Suspense>
      ) : null}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 px-6" aria-busy>
      {Array.from({ length: 6 }, (_, column) => (
        <div key={column} className="w-72 shrink-0 space-y-2 rounded-lg border border-line bg-panel/80 p-2">
          <Skeleton className="h-8" />
          {Array.from({ length: 3 - (column % 2) }, (_, card) => (
            <Skeleton key={card} className="h-24" />
          ))}
        </div>
      ))}
      <span className="sr-only">Carregando oportunidades</span>
    </div>
  );
}
