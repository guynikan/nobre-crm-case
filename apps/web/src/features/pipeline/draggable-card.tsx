"use client";

import { useDraggable } from "@dnd-kit/core";
import { isFinalStage, type CalendarDate, type Opportunity } from "@nobre/contracts";
import { cardClasses, OpportunityCardBody } from "./opportunity-card";

/** An opportunity card that can be dragged between columns, unless its stage is final. */
export function DraggableCard({
  opportunity,
  today,
  onOpen,
  isMoving,
}: {
  opportunity: Opportunity;
  today: CalendarDate;
  onOpen: (id: string) => void;
  isMoving: boolean;
}) {
  const isFinal = isFinalStage(opportunity.stage);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: isFinal || isMoving,
  });

  // Final cards are not draggable at all, so they should not announce themselves as such.
  const dragProps = isFinal ? {} : { ...attributes, ...listeners };

  return (
    <div className="relative">
      <article
        ref={setNodeRef}
        {...dragProps}
        aria-roledescription={isFinal ? undefined : "card arrastável"}
        aria-label={`${opportunity.code} ${opportunity.companyName}`}
        onClick={() => onOpen(opportunity.id)}
        className={`${cardClasses(opportunity)} ${isFinal ? "cursor-pointer select-none" : "cursor-grab"} transition hover:border-nobre-500/60 ${isDragging ? "opacity-30" : ""} ${isMoving ? "animate-pulse" : ""}`}
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
