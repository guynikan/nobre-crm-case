"use client";

import { useDraggable } from "@dnd-kit/core";
import { isFinalStage, type CalendarDate, type Opportunity } from "@nobre/contracts";
import { cardClasses, OpportunityCardBody } from "./opportunity-card";

/** An opportunity card that can be dragged between columns. */
export function DraggableCard({
  opportunity,
  today,
  onOpen,
  isMoving,
  isReturning,
}: {
  opportunity: Opportunity;
  today: CalendarDate;
  onOpen: (id: string) => void;
  isMoving: boolean;
  isReturning: boolean;
}) {
  const isFinal = isFinalStage(opportunity.stage);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: isMoving,
  });

  const dragProps = { ...attributes, ...listeners };

  return (
    <div className="relative">
      <article
        ref={setNodeRef}
        {...dragProps}
        aria-roledescription="card arrastável"
        aria-label={`${opportunity.code} ${opportunity.companyName}`}
        onClick={() => onOpen(opportunity.id)}
        className={`${cardClasses(opportunity)} cursor-grab ${isFinal ? "select-none" : ""} transition hover:border-nobre-500/60 ${isDragging && !isReturning ? "opacity-30" : ""} ${isMoving ? "animate-pulse" : ""}`}
      >
        <OpportunityCardBody opportunity={opportunity} today={today} />
      </article>
      {/* Sibling, not child: the draggable card already has role="button". */}
      <button
        type="button"
        onClick={() => onOpen(opportunity.id)}
        className="sr-only focus:not-sr-only focus:mt-1 focus:block focus:text-xs focus:text-nobre-700 focus:underline"
      >
        Abrir detalhes de {opportunity.code}
      </button>
    </div>
  );
}
