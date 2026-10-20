"use client";

import { isFinalStage, type AppMeta, type Opportunity } from "@nobre/contracts";
import { reachableStages } from "@nobre/domain";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { errorMessage } from "@/shared/api/client";
import { attentionLabel, formatCents, formatDate, formatDateTime, formatQuantity, STAGE_LABELS } from "@/shared/format";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { Button } from "@/shared/ui/fields";
import { ErrorState, Skeleton } from "@/shared/ui/states";
import { useMoveStage } from "../pipeline/api";
import { LostReasonDialog } from "../pipeline/lost-reason-dialog";
import { dateWarnings } from "../pipeline/opportunity-card";
import { useOpportunityDetail } from "./api";
import { ContactForm } from "./contact-form";
import { DrawerShell } from "./detail-skeleton";
import { EditCommercialData } from "./edit-commercial-data";

interface Props {
  id: string;
  meta: AppMeta;
  onClose: () => void;
}

export default function OpportunityDetail({ id, meta, onClose }: Props) {
  const { reset } = useQueryErrorResetBoundary();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <DrawerShell onClose={onClose} labelledBy="detail-title">
      <ErrorBoundary
        key={id}
        fallback={(error, retry) => (
          <div className="space-y-4 p-6">
            <CloseButton onClose={onClose} />
            <ErrorState
              {...errorMessage(error)}
              onRetry={() => {
                reset();
                retry();
              }}
            />
          </div>
        )}
      >
        <Suspense
          fallback={
            <div className="space-y-4 p-6" aria-busy>
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-40" />
            </div>
          }
        >
          <DetailContent id={id} meta={meta} onClose={onClose} />
        </Suspense>
      </ErrorBoundary>
    </DrawerShell>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink">
      Fechar ✕
    </button>
  );
}

function DetailContent({ id, meta, onClose }: Props) {
  const { opportunity, history, contacts } = useOpportunityDetail(id);
  const isFinal = isFinalStage(opportunity.stage);
  const warnings = dateWarnings(opportunity, meta.today);

  return (
    <div className="divide-y divide-line">
      <header className="space-y-2 p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            {opportunity.code}
            {opportunity.isSynthetic ? " · dado sintético" : ""}
          </span>
          <CloseButton onClose={onClose} />
        </div>
        <h2 id="detail-title" className="text-2xl leading-tight font-semibold">
          {opportunity.companyName}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-nobre-100 px-2.5 py-0.5 font-medium text-nobre-900">{STAGE_LABELS[opportunity.stage]}</span>
          <span className="text-muted">Vendedor: {opportunity.seller?.name ?? "não atribuído"}</span>
        </div>
        {opportunity.attention.needsAttention ? (
          <p role="status" className="rounded-md bg-alert-100 px-3 py-2 text-sm text-alert-600">
            <strong>{attentionLabel(opportunity.attention)}.</strong> Fale com o cliente e registre o contato abaixo.
          </p>
        ) : null}
        {warnings.length > 0 ? <p className="text-sm text-danger-600">{warnings.join(" · ")}</p> : null}
        {opportunity.lostReason ? (
          <p className="text-sm">
            <span className="text-muted">Motivo da perda:</span> {opportunity.lostReason}
          </p>
        ) : null}
      </header>

      {!isFinal ? <StageActions opportunity={opportunity} meta={meta} /> : null}

      <section className="p-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Valor estimado" value={<span className="font-mono">{formatCents(opportunity.estimatedValueCents)}</span>} />
          <Field label="Último contato" value={formatDate(opportunity.lastContactOn)} />
          <Field label="Validade da proposta" value={formatDate(opportunity.proposalValidUntil)} />
          <Field label="Evento do cliente" value={formatDate(opportunity.eventDate)} />
        </dl>
        <h3 className="mt-5 text-sm font-semibold">Itens de brinde</h3>
        {opportunity.items.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Nenhum item informado. É obrigatório para avançar para Apresentação de Orçamento.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {opportunity.items.map((item) => (
              <li key={item.id} className="flex justify-between border-b border-line/60 py-1 last:border-0">
                <span>{item.name}</span>
                <span className="font-mono">{formatQuantity(item.quantity)} un.</span>
              </li>
            ))}
          </ul>
        )}
        {!isFinal ? <EditCommercialData key={opportunity.version} opportunity={opportunity} /> : null}
      </section>

      <section className="space-y-3 p-6">
        <h3 className="text-sm font-semibold">Contatos</h3>
        {!isFinal ? <ContactForm opportunityId={opportunity.id} today={meta.today} /> : null}
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">Nenhum contato registrado.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded-md bg-paper px-3 py-2">
                <span className="font-medium">{formatDate(contact.contactedOn)}</span>
                {contact.note ? <span className="text-muted"> · {contact.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="p-6">
        <h3 className="text-sm font-semibold">Histórico de etapas</h3>
        <ol className="mt-2 space-y-2 border-l-2 border-line pl-4 text-sm">
          {history.map((entry) => (
            <li key={entry.id}>
              <p>
                {entry.fromStage ? (
                  <>
                    {STAGE_LABELS[entry.fromStage]} → <strong>{STAGE_LABELS[entry.toStage]}</strong>
                  </>
                ) : (
                  <>
                    Entrou em <strong>{STAGE_LABELS[entry.toStage]}</strong>
                  </>
                )}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(entry.changedAt)} · {entry.source === "SEED" ? "carga inicial" : "alteração no CRM"}
                {entry.lostReason ? ` · motivo: ${entry.lostReason}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

/** Keyboard-friendly alternative to dragging: only allowed targets are offered. */
function StageActions({ opportunity, meta }: { opportunity: Opportunity; meta: AppMeta }) {
  const move = useMoveStage();
  const [askLostReason, setAskLostReason] = useState(false);
  const targets = reachableStages(opportunity.stage);
  const moveTo = (toStage: (typeof targets)[number], lostReason?: string) =>
    move.mutate({
      opportunity,
      toStage,
      today: meta.today,
      thresholdDays: meta.attentionThresholdDays,
      ...(lostReason ? { lostReason } : {}),
    });

  return (
    <section className="space-y-2 p-6">
      <h3 className="text-sm font-semibold">Mover para</h3>
      <div className="flex flex-wrap gap-2">
        {targets
          .filter((stage) => stage !== "LOST")
          .map((stage) => (
            <Button key={stage} variant="secondary" disabled={move.isPending} onClick={() => moveTo(stage)}>
              {STAGE_LABELS[stage]}
            </Button>
          ))}
        <Button variant="danger" disabled={move.isPending} onClick={() => setAskLostReason(true)}>
          Marcar como Perdida
        </Button>
      </div>
      <LostReasonDialog
        opportunity={askLostReason ? opportunity : null}
        onCancel={() => setAskLostReason(false)}
        onConfirm={(reason) => {
          setAskLostReason(false);
          moveTo("LOST", reason);
        }}
      />
    </section>
  );
}
