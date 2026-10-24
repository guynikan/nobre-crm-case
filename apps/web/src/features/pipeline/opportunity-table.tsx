"use client";

import type { CalendarDate, Opportunity } from "@nobre/contracts";
import { attentionLabel, formatCents, formatDate, STAGE_LABELS } from "@/shared/format";
import { dateWarnings, priorityAccent } from "./opportunity-card";

/** Dense alternative to the board: same order as the API (what needs action first). */
export function OpportunityTable({
  opportunities,
  today,
  onOpen,
}: {
  opportunities: Opportunity[];
  today: CalendarDate;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mx-6 mb-6 overflow-auto rounded-lg border border-line bg-panel">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-panel text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2 font-medium">Código</th>
            <th className="px-3 py-2 font-medium">Empresa</th>
            <th className="px-3 py-2 font-medium">Etapa</th>
            <th className="px-3 py-2 font-medium">Vendedor</th>
            <th className="px-3 py-2 text-right font-medium">Valor est.</th>
            <th className="px-3 py-2 font-medium">Último contato</th>
            <th className="px-3 py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opportunity) => {
            const warnings = dateWarnings(opportunity, today);
            return (
              <tr key={opportunity.id} className="border-b border-line/70 last:border-0 hover:bg-nobre-100/40">
                <td
                  className={`border-l-4 py-2 pr-3 pl-2 font-mono text-xs text-muted ${priorityAccent(opportunity.attention.priority)}`}
                >
                  {opportunity.code}
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onOpen(opportunity.id)} className="text-left font-medium hover:underline">
                    {opportunity.companyName}
                  </button>
                </td>
                <td className="px-3 py-2">{STAGE_LABELS[opportunity.stage]}</td>
                <td className="px-3 py-2">{opportunity.seller?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCents(opportunity.estimatedValueCents)}</td>
                <td className="px-3 py-2">{formatDate(opportunity.lastContactOn)}</td>
                <td className="px-3 py-2 text-xs">
                  {opportunity.attention.needsAttention ? (
                    <span className="rounded bg-alert-100 px-1.5 py-0.5 font-medium text-alert-600">
                      {attentionLabel(opportunity.attention)}
                    </span>
                  ) : null}
                  {warnings.map((warning) => (
                    <span key={warning} className="ml-1 text-danger-600">
                      {warning}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
