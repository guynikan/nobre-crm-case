"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Opportunity, Stage } from "@nobre/contracts";
import type { ReactNode } from "react";
import { formatCents, STAGE_LABELS } from "@/shared/format";

/** How the column should read while a card is being dragged. */
export type DropState = "idle" | "allowed" | "blocked" | "origin";

/** One pipeline stage: its totals in the header and its cards as a drop target. */
export function BoardColumn({
  stage,
  opportunities,
  dropState,
  children,
}: {
  stage: Stage;
  opportunities: Opportunity[];
  dropState: DropState;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = opportunities.reduce((sum, item) => sum + (item.estimatedValueCents ?? 0), 0);
  const attentionCount = opportunities.filter((item) => item.attention.needsAttention).length;
  const stateClasses: Record<DropState, string> = {
    idle: "border-line",
    origin: "border-line",
    allowed: isOver ? "border-nobre-500 bg-nobre-100/70 ring-2 ring-nobre-500/40" : "border-nobre-500 border-dashed",
    blocked: "border-line opacity-45",
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABELS[stage]}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-panel/80 transition ${stateClasses[dropState]} ${stage === "LOST" ? "bg-paper/60" : ""}`}
    >
      <header className="sticky top-0 border-b border-line px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
          <span className="font-mono text-xs text-muted">{opportunities.length}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
          <span className="font-mono">{formatCents(total)}</span>
          {attentionCount > 0 ? <span className="font-medium text-alert-600">{attentionCount} precisam de atenção</span> : null}
        </div>
        {dropState === "blocked" ? <p className="mt-1 text-xs text-muted">Destino não permitido</p> : null}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {opportunities.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted">Nenhuma oportunidade nesta etapa</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
