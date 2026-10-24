"use client";

import type { CalendarDate, Reminder } from "@nobre/contracts";
import { daysBetween } from "@nobre/domain";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "@/shared/api/client";
import { formatDate, formatDateTime } from "@/shared/format";
import { Button } from "@/shared/ui/fields";
import { EmptyState, ErrorState, Skeleton } from "@/shared/ui/states";
import { useToast } from "@/shared/ui/toast";
import { useMeta } from "@/shared/api/queries";
import { useReminders, useRunFollowUp } from "./queries";
import { useNextCheck } from "./use-next-check";

/**
 * The follow-up work queue and a way to run the automation by hand. There is no page
 * behind it on purpose — the funnel is where work happens, this is where new reminders
 * are observed.
 */
export function RemindersHub({ onNavigate }: { onNavigate: () => void }) {
  const reminders = useReminders("OPEN");
  const meta = useMeta();
  const nextCheck = useNextCheck(meta.data?.followUpIntervalMinutes);
  const run = useRunFollowUp();
  const toast = useToast();
  const listContentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const content = listContentRef.current;
    if (!content) return;

    const updateHeight = () => setListHeight(content.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [reminders.data, reminders.isError, reminders.isPending]);

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
      <header className="flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Follow-up</h2>
          <p className="text-xs text-muted">Lembretes abertos e histórico do follow-up.</p>
        </div>
        <Button data-dialog-initial-focus className="w-36 shrink-0" onClick={runNow} disabled={run.isPending}>
          {run.isPending ? "Verificando…" : "Verificar agora"}
        </Button>
      </header>

      <div
        className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={listHeight === null ? undefined : { height: `${listHeight}px` }}
      >
      <div ref={listContentRef} className="max-h-[21rem] overflow-y-auto p-2">
        {reminders.isError ? (
          <ErrorState {...errorMessage(reminders.error)} onRetry={() => void reminders.refetch()} />
        ) : reminders.isPending ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : reminders.data.length === 0 ? (
          <EmptyState title="Nenhum lembrete aberto">
            Todas as oportunidades em aberto tiveram contato recente.
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
      </div>

      {nextCheck ? (
        <footer className="border-t border-line px-4 py-2 text-xs text-muted">
          Próxima verificação em: <span className="font-mono text-ink">{nextCheck}</span>
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
