"use client";

import type { AttentionPriority, CalendarDate, Opportunity } from "@nobre/contracts";
import { daysBetween } from "@nobre/domain";
import { attentionLabel, formatCents, formatQuantity, formatShortDate } from "@/shared/format";

/** Proposal and event dates relative to the business "today", worded for a seller. */
export function dateWarnings(opportunity: Opportunity, today: CalendarDate): string[] {
  const warnings: string[] = [];
  const isOpen = opportunity.stage !== "CLOSING" && opportunity.stage !== "LOST";
  if (!isOpen) return warnings;
  if (opportunity.proposalValidUntil && daysBetween(today, opportunity.proposalValidUntil) < 0) {
    warnings.push(`Proposta vencida em ${formatShortDate(opportunity.proposalValidUntil)}`);
  }
  if (opportunity.eventDate) {
    const days = daysBetween(today, opportunity.eventDate);
    if (days < 0) warnings.push(`Evento já passou (${formatShortDate(opportunity.eventDate)})`);
    else if (days <= 7) warnings.push(days === 0 ? "Evento hoje" : `Evento em ${days} ${days === 1 ? "dia" : "dias"}`);
  }
  return warnings;
}

export function OpportunityCardBody({ opportunity, today }: { opportunity: Opportunity; today: CalendarDate }) {
  const { attention } = opportunity;
  const firstItem = opportunity.items[0];
  const warnings = dateWarnings(opportunity, today);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] tracking-wide text-muted">{opportunity.code}</span>
        <span className="font-mono text-sm font-semibold">{formatCents(opportunity.estimatedValueCents)}</span>
      </div>
      <p className="mt-1 leading-snug font-semibold">{opportunity.companyName}</p>
      <p className="mt-0.5 truncate text-xs text-muted">
        {firstItem ? `${formatQuantity(firstItem.quantity)}× ${firstItem.name}` : "Sem itens de brinde"}
        {opportunity.items.length > 1 ? ` +${opportunity.items.length - 1}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-paper px-1.5 py-0.5 text-muted">{opportunity.seller?.name ?? "Sem vendedor"}</span>
        {attention.needsAttention ? (
          <span className="rounded bg-alert-100 px-1.5 py-0.5 font-medium text-alert-600">{attentionLabel(attention)}</span>
        ) : attention.daysSinceLastContact !== null ? (
          <span className="text-muted">{attentionLabel(attention)}</span>
        ) : null}
      </div>
      {warnings.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-xs text-danger-600">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {opportunity.stage === "LOST" && opportunity.lostReason ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted italic">“{opportunity.lostReason}”</p>
      ) : null}
    </>
  );
}

/**
 * Three visual weights follow the recoverability of each urgency gate. Both the board
 * and list use this mapping so a row and card never disagree about urgency.
 */
export function priorityAccent(priority: AttentionPriority | null): string {
  if (priority === null) return "border-l-transparent";
  if (priority === "UNTOUCHED" || priority === "EVENT_IMMINENT") return "border-l-danger-600";
  if (priority === "PROPOSAL_EXPIRED") return "border-l-alert-600";
  return "border-l-overdue-500";
}

export function cardClasses(opportunity: Opportunity) {
  const finished = opportunity.stage === "LOST" ? "opacity-75" : "";
  // The card already spells out which deadline, so repeating it here would only add noise.
  return `rounded-md border border-line border-l-4 ${priorityAccent(opportunity.attention.priority)} ${finished} bg-white p-3 text-left shadow-sm`;
}
