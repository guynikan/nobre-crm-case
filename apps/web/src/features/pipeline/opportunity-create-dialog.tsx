"use client";

import { useState, type FormEvent } from "react";
import { useSellers } from "@/shared/api/queries";
import { parseMoneyToCents } from "@/shared/format";
import { Dialog } from "@/shared/ui/dialog";
import { Button, CurrencyInput, inputClass } from "@/shared/ui/fields";
import { useCreateOpportunity } from "./queries";

interface ItemDraft {
  key: number;
  name: string;
  quantity: string;
}

export function OpportunityCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const sellers = useSellers();
  const create = useCreateOpportunity();
  const [companyName, setCompanyName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [value, setValue] = useState("");
  const [proposalValidUntil, setProposalValidUntil] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCompanyName("");
    setSellerId("");
    setValue("");
    setProposalValidUntil("");
    setEventDate("");
    setItems([]);
    setNextKey(0);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyName.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }

    const estimatedValueCents = parseMoneyToCents(value);
    if (value.trim() && estimatedValueCents === null) {
      setError("Valor inválido. Use, por exemplo, 4.500,00.");
      return;
    }

    const giftItems = items
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) }));
    if (giftItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000)) {
      setError("A quantidade de cada brinde precisa ser um inteiro entre 1 e 1.000.000.");
      return;
    }

    setError(null);
    create.mutate(
      {
        companyName: companyName.trim(),
        sellerId: sellerId || null,
        estimatedValueCents,
        items: giftItems,
        proposalValidUntil: proposalValidUntil || null,
        eventDate: eventDate || null,
      },
      {
        onSuccess: (created) => {
          reset();
          onCreated(created.id);
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={close} title="Nova oportunidade">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Ela começa em Primeiro Contato. Valor e itens são opcionais até a apresentação do orçamento.
        </p>

        <div>
          <label htmlFor="new-company-name" className="text-xs font-medium text-muted">
            Empresa <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-company-name"
            className={`${inputClass} mt-1 w-full`}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            maxLength={160}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-seller" className="text-xs font-medium text-muted">
              Vendedor
            </label>
            <select
              id="new-seller"
              className={`${inputClass} mt-1 w-full`}
              value={sellerId}
              onChange={(event) => setSellerId(event.target.value)}
              disabled={sellers.isPending}
            >
              <option value="">Sem vendedor</option>
              {sellers.data?.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-estimated-value" className="text-xs font-medium text-muted">
              Valor estimado
            </label>
            <CurrencyInput
              id="new-estimated-value"
              className="mt-1"
              placeholder="0,00"
              value={value}
              onValueChange={setValue}
            />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">Brindes (opcional)</legend>
          {items.map((item, index) => (
            <div key={item.key} className="flex gap-2">
              <input
                aria-label={`Nome do brinde ${index + 1}`}
                className={`${inputClass} min-w-0 flex-1`}
                placeholder="Caneca personalizada"
                maxLength={120}
                value={item.name}
                onChange={(event) =>
                  setItems((current) => current.map((row) => (row.key === item.key ? { ...row, name: event.target.value } : row)))
                }
              />
              <input
                aria-label={`Quantidade do brinde ${index + 1}`}
                className={`${inputClass} w-24`}
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                placeholder="Qtd."
                value={item.quantity}
                onChange={(event) =>
                  setItems((current) => current.map((row) => (row.key === item.key ? { ...row, quantity: event.target.value } : row)))
                }
              />
              <Button
                variant="ghost"
                aria-label={`Remover brinde ${index + 1}`}
                onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            className="-ml-3"
            disabled={items.length >= 50}
            onClick={() => {
              setItems((current) => [...current, { key: nextKey, name: "", quantity: "1" }]);
              setNextKey((current) => current + 1);
            }}
          >
            {items.length >= 50 ? "Limite de 50 brindes atingido" : "+ Adicionar brinde"}
          </Button>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-proposal-valid-until" className="text-xs font-medium text-muted">
              Validade da proposta
            </label>
            <input
              id="new-proposal-valid-until"
              type="date"
              className={`${inputClass} mt-1 w-full`}
              value={proposalValidUntil}
              onChange={(event) => setProposalValidUntil(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-event-date" className="text-xs font-medium text-muted">
              Evento do cliente
            </label>
            <input
              id="new-event-date"
              type="date"
              className={`${inputClass} mt-1 w-full`}
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </div>
        </div>

        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Criando…" : "Criar oportunidade"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
