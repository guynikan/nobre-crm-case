"use client";

import type { Opportunity } from "@nobre/contracts";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/api/client";
import { parseMoneyToCents } from "@/shared/format";
import { Button, inputClass } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/toast";
import { useUpdateOpportunity } from "./api";

interface ItemDraft {
  key: number;
  name: string;
  quantity: string;
}

/** Value and gift items: what a lead needs before it can get a quote. */
export function EditCommercialData({ opportunity }: { opportunity: Opportunity }) {
  const update = useUpdateOpportunity(opportunity.id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    opportunity.estimatedValueCents === null ? "" : String(opportunity.estimatedValueCents / 100).replace(".", ","),
  );
  const [items, setItems] = useState<ItemDraft[]>(
    opportunity.items.map((item, key) => ({ key, name: item.name, quantity: String(item.quantity) })),
  );
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <Button variant="ghost" className="mt-3 -ml-3" onClick={() => setEditing(true)}>
        Editar valor e itens
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
      { expectedVersion: opportunity.version, estimatedValueCents: cents, items: parsedItems },
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
          Valor estimado (R$)
        </label>
        <input
          id="estimated-value"
          inputMode="decimal"
          className={`${inputClass} w-full`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="4.500,00"
        />
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
