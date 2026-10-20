"use client";

import type { ReminderStatus } from "@nobre/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { errorMessage } from "@/shared/api/client";
import { useMeta, useSellers } from "@/shared/api/shared-queries";
import { formatDate, formatDateTime } from "@/shared/format";
import { Button, inputClass } from "@/shared/ui/fields";
import { EmptyState, ErrorState, Skeleton } from "@/shared/ui/states";
import { useToast } from "@/shared/ui/toast";
import { useReminders, useRunFollowUp } from "./api";

export function RemindersPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status: ReminderStatus = params.get("status") === "RESOLVED" ? "RESOLVED" : "OPEN";
  const sellerId = params.get("seller") ?? undefined;

  const meta = useMeta();
  const sellers = useSellers();
  const reminders = useReminders(status, sellerId);
  const run = useRunFollowUp();
  const toast = useToast();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/lembretes${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  function runNow() {
    run.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          "Follow-up executado",
          `Data de referência ${formatDate(result.referenceDate)}: ${result.created} criado(s), ${result.resolved} encerrado(s), ${result.open} aberto(s).`,
        ),
      onError: (error) => toast.error(errorMessage(error).title, errorMessage(error).detail),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lembretes de follow-up</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Criados automaticamente para oportunidades em aberto sem contato há {meta.data?.attentionThresholdDays ?? 2} dias ou mais (ou sem nenhum contato registrado).
            Encerram sozinhos quando um contato é registrado ou a oportunidade é ganha ou perdida.
          </p>
        </div>
        <Button onClick={runNow} disabled={run.isPending}>
          {run.isPending ? "Verificando…" : "Verificar agora"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Situação" className="flex rounded-md border border-line bg-panel p-0.5 text-sm">
          {(["OPEN", "RESOLVED"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={status === value}
              onClick={() => setParam("status", value === "OPEN" ? null : value)}
              className={`rounded px-3 py-1 ${status === value ? "bg-nobre-700 text-white" : "text-muted hover:text-ink"}`}
            >
              {value === "OPEN" ? "Abertos" : "Encerrados"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Vendedor</span>
          <select className={`${inputClass} w-44`} value={sellerId ?? ""} onChange={(event) => setParam("seller", event.target.value || null)}>
            <option value="">Todos</option>
            {sellers.data?.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </select>
        </label>
        {isPending || reminders.isFetching ? <span className="text-sm text-muted">Atualizando…</span> : null}
      </div>

      {reminders.isError ? (
        <ErrorState {...errorMessage(reminders.error)} onRetry={() => void reminders.refetch()} />
      ) : reminders.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : reminders.data.length === 0 ? (
        <EmptyState title={status === "OPEN" ? "Nenhum lembrete aberto" : "Nenhum lembrete encerrado"}>
          {status === "OPEN" ? "Todas as oportunidades em aberto tiveram contato recente." : null}
        </EmptyState>
      ) : (
        <ul className={`space-y-2 transition-opacity ${isPending ? "opacity-60" : ""}`}>
          {reminders.data.map((reminder) => (
            <li key={reminder.id} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  <span className="mr-2 font-mono text-xs text-muted">{reminder.opportunityCode}</span>
                  {reminder.companyName}
                </p>
                <p className="text-sm text-muted">
                  {reminder.reason === "NO_CONTACT_RECORDED"
                    ? "Nenhum contato registrado"
                    : `${reminder.daysSinceLastContact} dias sem contato`}
                  {" · "}
                  {reminder.sellerName ?? "sem vendedor"}
                  {" · "}
                  {reminder.status === "OPEN"
                    ? `aberto em ${formatDate(reminder.dueOn)}`
                    : `encerrado em ${reminder.resolvedAt ? formatDateTime(reminder.resolvedAt) : "—"}`}
                </p>
              </div>
              <Link
                href={`/?opportunity=${reminder.opportunityId}`}
                className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper"
              >
                Abrir oportunidade
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
