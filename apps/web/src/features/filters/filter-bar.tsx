"use client";

import { STAGES } from "@nobre/contracts";
import { useEffect, useState } from "react";
import { useSellers } from "@/shared/api/queries";
import { STAGE_LABELS } from "@/shared/format";
import { inputClass } from "@/shared/ui/fields";
import type { BoardView, OpportunityFilters, UrlPatch } from "./use-opportunity-filters";

const SEARCH_DEBOUNCE_MS = 250;

export function FilterBar({
  filters,
  view,
  update,
  hasActiveFilters,
}: {
  filters: OpportunityFilters;
  view: BoardView;
  update: (patch: UrlPatch) => void;
  hasActiveFilters: boolean;
}) {
  const sellers = useSellers();
  // The input owns its text so typing never waits for the URL or the network.
  const [search, setSearch] = useState(filters.search);

  useEffect(() => setSearch(filters.search), [filters.search]);

  useEffect(() => {
    if (search.trim() === filters.search) return;
    const timer = setTimeout(() => update({ search: search.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters.search, update]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="search">
        Buscar por empresa ou código
      </label>
      <input
        id="search"
        type="search"
        placeholder="Buscar empresa ou código (ex.: OPP-2004)"
        className={`${inputClass} w-80`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <label className="sr-only" htmlFor="seller">
        Vendedor
      </label>
      <select
        id="seller"
        className={`${inputClass} w-44`}
        value={filters.sellerId ?? ""}
        onChange={(event) => update({ sellerId: event.target.value || null })}
        disabled={sellers.isPending}
      >
        <option value="">Todos os vendedores</option>
        {sellers.data?.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.name}
          </option>
        ))}
      </select>

      {view === "list" ? (
        <>
          <label className="sr-only" htmlFor="stage">
            Etapa
          </label>
          <select
            id="stage"
            className={`${inputClass} w-56`}
            value={filters.stage ?? ""}
            onChange={(event) => update({ stage: event.target.value || null })}
          >
            <option value="">Todas as etapas</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            update({ search: null, sellerId: null, stage: null });
          }}
          className="text-sm text-nobre-700 underline-offset-2 hover:underline"
        >
          Limpar filtros
        </button>
      ) : null}

      <div className="ml-auto inline-flex rounded-md border border-line bg-panel p-0.5" role="group" aria-label="Visualização">
        {(["board", "list"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => update({ view: option === "board" ? null : "list", stage: null })}
            className={`rounded px-3 py-1.5 text-sm ${view === option ? "bg-nobre-700 text-white" : "text-muted hover:text-ink"}`}
          >
            {option === "board" ? "Quadro" : "Lista"}
          </button>
        ))}
      </div>
    </div>
  );
}
