"use client";

import type { Opportunity } from "@nobre/contracts";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/api/client";
import { formatCentsForInput, parseMoneyToCents } from "@/shared/format";
import { Button, CurrencyInput, inputClass } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/toast";
import { useUpdateOpportunity } from "./queries";

interface ItemDraft {
  key: number;
  name: string;
  quantity: string;
}

/**
 * What the funnel rules read: the value and items a quote needs, and the two dates the
 * urgency gates key off. A reissued quote or a rescheduled event has to land somewhere.
 */
export function EditCommercialData({ opportunity }: { opportunity: Opportunity }) {
  const update = useUpdateOpportunity(opportunity.id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(formatCentsForInput(opportunity.estimatedValueCents));
  const [items, setItems] = useState<ItemDraft[]>(
    opportunity.items.map((item, key) => ({ key, name: item.name, quantity: String(item.quantity) })),
  );
  const [proposalValidUntil, setProposalValidUntil] = useState(opportunity.proposalValidUntil ?? "");
  const [eventDate, setEventDate] = useState(opportunity.eventDate ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <Button variant="ghost" className="mt-3 -ml-3" onClick={() => setEditing(true)}>
        Editar dados comerciais
      </Button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = parseMoneyToCents(value);
    if (value.trim() !== "" && cents === null) return setError("Valor inválido. Use, por exemplo, 4.500,00.");
    const parsedItems = items
      .filter((item) => item.name.trim() !== "")
      .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) }));
    if (parsedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return setError("A quantidade de cada item precisa ser um número inteiro maior que zero.");
    }
    setError(null);
    update.mutate(
      {
        expectedVersion: opportunity.version,
        estimatedValueCents: cents,
        items: parsedItems,
        proposalValidUntil: proposalValidUntil || null,
        eventDate: eventDate || null,
      },
      {
        onSuccess: () => toast.success("Dados atualizados"),
        onError: (failure) => setError(errorMessage(failure).title),
      },
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border border-line p-3">
      <div>
        <label htmlFor="estimated-value" className="text-xs text-muted">
          Valor estimado
        </label>
        <CurrencyInput
          id="estimated-value"
          className="mt-1"
          value={value}
          onValueChange={setValue}
          placeholder="0,00"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="proposal-valid-until" className="text-xs text-muted">
            Validade da proposta
          </label>
          <input
            id="proposal-valid-until"
            type="date"
            className={`${inputClass} w-full`}
            value={proposalValidUntil}
            onChange={(event) => setProposalValidUntil(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-date" className="text-xs text-muted">
            Evento do cliente
          </label>
          <input
            id="event-date"
            type="date"
            className={`${inputClass} w-full`}
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted">Itens de brinde</legend>
        {items.map((item, index) => (
          <div key={item.key} className="flex gap-2">
            <input
              aria-label={`Item ${index + 1}`}
              className={`${inputClass} min-w-0 flex-1`}
              value={item.name}
              maxLength={120}
              onChange={(event) => setItems(items.map((row) => (row.key === item.key ? { ...row, name: event.target.value } : row)))}
              placeholder="Caneca personalizada"
            />
            <input
              aria-label={`Quantidade do item ${index + 1}`}
              className={`${inputClass} w-28`}
              inputMode="numeric"
              value={item.quantity}
              onChange={(event) => setItems(items.map((row) => (row.key === item.key ? { ...row, quantity: event.target.value } : row)))}
              placeholder="Qtd."
            />
            <Button variant="ghost" aria-label={`Remover item ${index + 1}`} onClick={() => setItems(items.filter((row) => row.key !== item.key))}>
              ✕
            </Button>
          </div>
        ))}
        <Button variant="ghost" className="-ml-3" onClick={() => setItems([...items, { key: Date.now(), name: "", quantity: "1" }])}>
          + Adicionar item
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
