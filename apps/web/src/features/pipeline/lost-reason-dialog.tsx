"use client";

import type { Opportunity } from "@nobre/contracts";
import { useState, type FormEvent } from "react";
import { Dialog } from "@/shared/ui/dialog";
import { Button, inputClass } from "@/shared/ui/fields";

const SUGGESTIONS = [
  "Preço acima do orçamento do cliente",
  "Cliente fechou com concorrente",
  "Prazo de produção incompatível com o evento",
  "Evento cancelado pelo cliente",
];

/** Lost is final and needs a reason, so the move only happens after the seller confirms it. */
export function LostReasonDialog({
  opportunity,
  onCancel,
  onConfirm,
}: {
  opportunity: Opportunity | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (trimmed.length < 3) return;
    onConfirm(trimmed);
    setReason("");
  }

  return (
    <Dialog
      open={opportunity !== null}
      onClose={() => {
        setReason("");
        onCancel();
      }}
      title={`Marcar ${opportunity?.code ?? ""} como Perdida`}
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Perdida é uma etapa final: depois disso a oportunidade não muda mais de etapa. Informe o motivo para o time
          aprender com a perda.
        </p>
        <label className="block text-sm font-medium" htmlFor="lost-reason">
          Motivo da perda
        </label>
        <textarea
          id="lost-reason"
          className={`${inputClass} min-h-20 w-full`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          required
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setReason(suggestion)}
              className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-nobre-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
        {reason.length > 0 && trimmed.length < 3 ? (
          <p className="text-xs text-danger-600">O motivo precisa ter pelo menos 3 caracteres.</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={trimmed.length < 3}>
            Marcar como Perdida
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
