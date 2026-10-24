"use client";

import { STAGES, type Seller } from "@nobre/contracts";
import { useEffect, useRef, useState } from "react";
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

      <SellerSelect
        sellers={sellers.data ?? []}
        selectedSellerId={filters.sellerId}
        disabled={sellers.isPending}
        onChange={(sellerId) => update({ sellerId })}
      />

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

function SellerSelect({
  sellers,
  selectedSellerId,
  disabled,
  onChange,
}: {
  sellers: Seller[];
  selectedSellerId: string | undefined;
  disabled: boolean;
  onChange: (sellerId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedSeller = sellers.find((seller) => seller.id === selectedSellerId);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (sellerId: string | null) => {
    onChange(sellerId);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative w-60 max-w-full shrink-0">
      <button
        ref={triggerRef}
        id="seller"
        type="button"
        aria-label={disabled ? "Carregando vendedores" : `Vendedor: ${selectedSeller?.name ?? "Todos os vendedores"}`}
        aria-expanded={open}
        aria-controls={open ? "seller-options" : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-left text-sm transition-colors hover:border-nobre-500 focus:border-nobre-500 focus:outline-none disabled:cursor-wait disabled:opacity-60"
      >
        <SellerAvatar name={selectedSeller?.name} />
        <span className="min-w-0 flex-1 break-words text-ink">
          {disabled ? "Carregando vendedores" : selectedSeller?.name ?? "Todos os vendedores"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id="seller-options"
          role="group"
          aria-label="Opções de vendedor"
          className="absolute top-full left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-panel p-2 shadow-lg shadow-ink/10"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Filtrar por vendedor</p>
            <p className="mt-0.5 text-xs text-muted">{sellers.length} {sellers.length === 1 ? "vendedor" : "vendedores"}</p>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto border-t border-line pt-1.5">
            <SellerOption
              label="Todos os vendedores"
              selected={!selectedSellerId}
              onClick={() => choose(null)}
              allSellers
            />
            {sellers.map((seller) => (
              <SellerOption
                key={seller.id}
                label={seller.name}
                selected={selectedSellerId === seller.id}
                onClick={() => choose(seller.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SellerOption({
  label,
  selected,
  onClick,
  allSellers = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  allSellers?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${
        selected ? "bg-nobre-100 text-nobre-900" : "text-ink hover:bg-paper"
      }`}
    >
      <SellerAvatar name={allSellers ? undefined : label} allSellers={allSellers} />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      {selected ? (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-nobre-700">
          <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

function SellerAvatar({ name, allSellers = false }: { name: string | undefined; allSellers?: boolean }) {
  const initials = name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
        allSellers || !name ? "bg-paper text-muted" : "bg-nobre-100 text-nobre-700"
      }`}
    >
      {allSellers || !name ? (
        <svg viewBox="0 0 20 20" fill="none" className="size-4">
          <path d="M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 17v-1a5 5 0 0 1 10 0v1M13 4.5a3 3 0 0 1 0 5.8M15 12a4 4 0 0 1 2.5 3.7v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        initials
      )}
    </span>
  );
}
