"use client";

import type { CalendarDate } from "@nobre/contracts";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/api/client";
import { Button, inputClass } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/toast";
import { useRegisterContact } from "./queries";

export function ContactForm({ opportunityId, today }: { opportunityId: string; today: CalendarDate }) {
  const register = useRegisterContact(opportunityId);
  const toast = useToast();
  const [contactedOn, setContactedOn] = useState(today);
  const [note, setNote] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    register.mutate(
      { contactedOn, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: (updated) => {
          setNote("");
          toast.success(
            "Contato registrado",
            updated.attention.needsAttention ? "A data ainda está antiga: o lembrete continua aberto." : "O lembrete de follow-up foi encerrado.",
          );
        },
        onError: (error) => toast.error(errorMessage(error).title, errorMessage(error).detail),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-line p-3">
      <div className="flex gap-2">
        <div className="w-40">
          <label htmlFor="contacted-on" className="text-xs text-muted">
            Data do contato
          </label>
          <input
            id="contacted-on"
            type="date"
            className={`${inputClass} w-full`}
            value={contactedOn}
            max={today}
            required
            onChange={(event) => setContactedOn(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="contact-note" className="text-xs text-muted">
            O que foi conversado (opcional)
          </label>
          <input
            id="contact-note"
            className={`${inputClass} w-full`}
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: cliente pediu nova cor para a caneca"
          />
        </div>
      </div>
      <Button type="submit" disabled={register.isPending}>
        {register.isPending ? "Registrando…" : "Registrar contato"}
      </Button>
    </form>
  );
}
