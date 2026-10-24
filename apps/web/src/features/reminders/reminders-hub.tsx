"use client";

import type { CalendarDate, Reminder, ReminderStatus } from "@nobre/contracts";
import { daysBetween } from "@nobre/domain";
import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/shared/api/client";
import { formatDate, formatDateTime } from "@/shared/format";
import { Button } from "@/shared/ui/fields";
import { EmptyState, ErrorState, Skeleton } from "@/shared/ui/states";
import { useToast } from "@/shared/ui/toast";
import { useMeta } from "@/shared/api/queries";
import { useReminders, useRunFollowUp } from "./queries";

/**
 * Everything the follow-up automation produces, in one panel: what is pending, what it
 * already closed, and a way to run it by hand. There is no page behind it on purpose —
 * the funnel is where work happens, this is only where the job is observed.
 */
export function RemindersHub({ onNavigate }: { onNavigate: () => void }) {
  const [status, setStatus] = useState<ReminderStatus>("OPEN");
  const reminders = useReminders(status);
  const meta = useMeta();
  const run = useRunFollowUp();
  const toast = useToast();

  function runNow() {
    run.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          "Follow-up executado",
          `${result.created} criado(s), ${result.resolved} encerrado(s), ${result.open} aberto(s).`,
        ),
      onError: (error) => toast.error(errorMessage(error).title, errorMessage(error).detail),
    });
  }

  return (
    <div className="flex max-h-[32rem] w-[26rem] max-w-[calc(100vw-2rem)] flex-col text-ink">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Follow-up</h2>
          <p className="text-xs text-muted">
            {status === "OPEN"
              ? "Retome o contato com quem está esperando."
              : "Encerrados quando o contato foi registrado ou a venda terminou."}
          </p>
        </div>
        <Button onClick={runNow} disabled={run.isPending}>
          {run.isPending ? "Verificando…" : "Verificar agora"}
        </Button>
      </header>

      <div role="tablist" aria-label="Situação" className="flex gap-1 border-b border-line px-4 py-2 text-sm">
        {(["OPEN", "RESOLVED"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={`rounded px-2.5 py-1 ${status === value ? "bg-nobre-700 text-white" : "text-muted hover:text-ink"}`}
          >
            {value === "OPEN" ? "Abertos" : "Encerrados"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {reminders.isError ? (
          <ErrorState {...errorMessage(reminders.error)} onRetry={() => void reminders.refetch()} />
        ) : reminders.isPending ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : reminders.data.length === 0 ? (
          <EmptyState title={status === "OPEN" ? "Nenhum lembrete aberto" : "Nenhum lembrete encerrado"}>
            {status === "OPEN" ? "Todas as oportunidades em aberto tiveram contato recente." : null}
          </EmptyState>
        ) : (
          <ul className="space-y-1">
            {reminders.data.map((reminder) => (
              <li key={reminder.id}>
                <Link
                  href={`/?opportunity=${reminder.opportunityId}`}
                  onClick={onNavigate}
                  className="block rounded-md px-2 py-2 hover:bg-paper"
                >
                  <p className="truncate text-sm font-medium">
                    <span className="mr-2 font-mono text-xs text-muted">{reminder.opportunityCode}</span>
                    {reminder.companyName}
                  </p>
                  {meta.data ? (
                    <p className="text-xs">
                      <span className="font-medium text-alert-600">{why(reminder, meta.data.today)}</span>
                      <span className="text-muted"> · {describe(reminder)}</span>
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta.data?.followUpIntervalMinutes ? (
        <footer className="border-t border-line px-4 py-2 text-xs text-muted">
          Verificado a cada {meta.data.followUpIntervalMinutes} minutos.
        </footer>
      ) : null}
    </div>
  );
}

/**
 * The reason this reminder sits where it sits. Showing the day count instead would
 * contradict the order on screen, since the list is ranked by deadline, not by silence.
 */
function why(reminder: Reminder, today: CalendarDate): string {
  const days = (date: CalendarDate) => Math.abs(daysBetween(today, date));
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

  switch (reminder.priority) {
    case "UNTOUCHED":
      return "Nunca contatado";
    case "EVENT_IMMINENT": {
      if (!reminder.eventDate) return "Evento próximo";
      const left = daysBetween(today, reminder.eventDate);
      if (left === 0) return "Evento hoje";
      return `Evento em ${left} ${plural(left, "dia", "dias")}`;
    }
    case "PROPOSAL_EXPIRED": {
      if (!reminder.proposalValidUntil) return "Proposta vencida";
      const ago = days(reminder.proposalValidUntil);
      return `Proposta vencida há ${ago} ${plural(ago, "dia", "dias")}`;
    }
    default:
      return reminder.reason === "NO_CONTACT_RECORDED"
        ? "Nenhum contato registrado"
        : `${reminder.daysSinceLastContact} dias sem contato`;
  }
}

function describe(reminder: Reminder): string {
  const who = reminder.sellerName ?? "sem vendedor";
  const when =
    reminder.status === "OPEN"
      ? `aberto em ${formatDate(reminder.dueOn)}`
      : `encerrado em ${reminder.resolvedAt ? formatDateTime(reminder.resolvedAt) : "—"}`;
  return `${who} · ${when}`;
}
