"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { isFinalStage, PIPELINE_STAGES, type CalendarDate, type Opportunity, type Stage } from "@nobre/contracts";
import { reachableStages } from "@nobre/domain";
import { useMutationState } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { formatCents, STAGE_LABELS } from "@/shared/format";
import { useToast } from "@/shared/ui/toast";
import { MOVE_STAGE_KEY, useMoveStage, type MoveStageInput } from "./api";
import { LostReasonDialog } from "./lost-reason-dialog";
import { cardClasses, OpportunityCardBody } from "./opportunity-card";

const BOARD_COLUMNS: readonly Stage[] = [...PIPELINE_STAGES, "LOST"];

interface BoardProps {
  opportunities: Opportunity[];
  today: CalendarDate;
  thresholdDays: number;
  onOpen: (id: string) => void;
}

/** Why a drop is refused, in the seller's words. The API still validates every move. */
function refusalMessage(from: Stage, to: Stage): string {
  if (isFinalStage(from)) return `${STAGE_LABELS[from]} é uma etapa final: a oportunidade não muda mais de etapa.`;
  const targets = reachableStages(from).map((stage) => STAGE_LABELS[stage]);
  return `De ${STAGE_LABELS[from]} não é possível ir para ${STAGE_LABELS[to]}. Destinos permitidos: ${targets.join(", ")}.`;
}

const announcements = (byId: Map<string, Opportunity>): Announcements => ({
  onDragStart: ({ active }) => `Movendo ${byId.get(String(active.id))?.companyName ?? "oportunidade"}.`,
  onDragOver: ({ over }) => (over ? `Sobre a coluna ${STAGE_LABELS[over.id as Stage]}.` : "Fora das colunas."),
  onDragEnd: ({ over }) => (over ? `Solta em ${STAGE_LABELS[over.id as Stage]}.` : "Movimento cancelado."),
  onDragCancel: () => "Movimento cancelado.",
});

export function PipelineBoard({ opportunities, today, thresholdDays, onOpen }: BoardProps) {
  const move = useMoveStage();
  const toast = useToast();
  const [active, setActive] = useState<Opportunity | null>(null);
  const [pendingLost, setPendingLost] = useState<Opportunity | null>(null);
  const sensors = useSensors(
    // A short distance keeps a click on the card as "open details" instead of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const movingIds = new Set(
    useMutationState({
      filters: { mutationKey: MOVE_STAGE_KEY, status: "pending" },
      select: (mutation) => (mutation.state.variables as MoveStageInput).opportunity.id,
    }),
  );

  const { byStage, byId } = useMemo(() => {
    const byStage = new Map<Stage, Opportunity[]>(BOARD_COLUMNS.map((stage) => [stage, []]));
    for (const opportunity of opportunities) byStage.get(opportunity.stage)?.push(opportunity);
    return { byStage, byId: new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])) };
  }, [opportunities]);

  const allowedTargets = active ? new Set(reachableStages(active.stage)) : null;
  // The browser fires a click when a drag ends over the same card; that must not open the drawer.
  const lastDragEnd = useRef(0);
  const openUnlessJustDragged = (id: string) => {
    if (Date.now() - lastDragEnd.current > 250) onOpen(id);
  };

  function handleDragStart({ active: dragged }: DragStartEvent) {
    setActive(byId.get(String(dragged.id)) ?? null);
  }

  function handleDragEnd({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    lastDragEnd.current = Date.now();
    const opportunity = byId.get(String(dragged.id));
    if (!opportunity || !over) return;
    const toStage = over.id as Stage;
    if (toStage === opportunity.stage) return;
    if (!reachableStages(opportunity.stage).includes(toStage)) {
      toast.info("Movimento não permitido", refusalMessage(opportunity.stage, toStage));
      return;
    }
    if (toStage === "LOST") {
      setPendingLost(opportunity);
      return;
    }
    move.mutate({ opportunity, toStage, today, thresholdDays });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActive(null);
        lastDragEnd.current = Date.now();
      }}
      accessibility={{
        announcements: announcements(byId),
        screenReaderInstructions: {
          draggable:
            "Para mover, pressione espaço, use as setas para escolher a coluna e espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <div className="board-surface flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
        {BOARD_COLUMNS.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            opportunities={byStage.get(stage) ?? []}
            dropState={allowedTargets === null ? "idle" : allowedTargets.has(stage) ? "allowed" : active?.stage === stage ? "origin" : "blocked"}
          >
            {(byStage.get(stage) ?? []).map((opportunity) => (
              <DraggableCard
                key={opportunity.id}
                opportunity={opportunity}
                today={today}
                onOpen={openUnlessJustDragged}
                isMoving={movingIds.has(opportunity.id)}
              />
            ))}
          </BoardColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className={`${cardClasses(active)} w-72 rotate-1 cursor-grabbing shadow-xl`}>
            <OpportunityCardBody opportunity={active} today={today} />
          </div>
        ) : null}
      </DragOverlay>

      <LostReasonDialog
        opportunity={pendingLost}
        onCancel={() => setPendingLost(null)}
        onConfirm={(lostReason) => {
          if (pendingLost) move.mutate({ opportunity: pendingLost, toStage: "LOST", lostReason, today, thresholdDays });
          setPendingLost(null);
        }}
      />
    </DndContext>
  );
}

type DropState = "idle" | "allowed" | "blocked" | "origin";

function BoardColumn({
  stage,
  opportunities,
  dropState,
  children,
}: {
  stage: Stage;
  opportunities: Opportunity[];
  dropState: DropState;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = opportunities.reduce((sum, item) => sum + (item.estimatedValueCents ?? 0), 0);
  const attentionCount = opportunities.filter((item) => item.attention.needsAttention).length;
  const stateClasses: Record<DropState, string> = {
    idle: "border-line",
    origin: "border-line",
    allowed: isOver ? "border-nobre-500 bg-nobre-100/70 ring-2 ring-nobre-500/40" : "border-nobre-500 border-dashed",
    blocked: "border-line opacity-45",
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABELS[stage]}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-panel/80 transition ${stateClasses[dropState]} ${stage === "LOST" ? "bg-paper/60" : ""}`}
    >
      <header className="sticky top-0 border-b border-line px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
          <span className="font-mono text-xs text-muted">{opportunities.length}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
          <span className="font-mono">{formatCents(total)}</span>
          {attentionCount > 0 ? <span className="font-medium text-alert-600">{attentionCount} precisam de atenção</span> : null}
        </div>
        {dropState === "blocked" ? <p className="mt-1 text-xs text-muted">Destino não permitido</p> : null}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {opportunities.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted">Nenhuma oportunidade nesta etapa</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  opportunity,
  today,
  onOpen,
  isMoving,
}: {
  opportunity: Opportunity;
  today: CalendarDate;
  onOpen: (id: string) => void;
  isMoving: boolean;
}) {
  const isFinal = isFinalStage(opportunity.stage);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: isFinal || isMoving,
  });

  // Final cards are not draggable at all, so they should not announce themselves as such.
  const dragProps = isFinal ? {} : { ...attributes, ...listeners };

  return (
    <div className="relative">
      <article
        ref={setNodeRef}
        {...dragProps}
        aria-roledescription={isFinal ? undefined : "card arrastável"}
        aria-label={`${opportunity.code} ${opportunity.companyName}`}
        onClick={() => onOpen(opportunity.id)}
        className={`${cardClasses(opportunity)} ${isFinal ? "cursor-pointer" : "cursor-grab"} transition hover:border-nobre-500/60 ${isDragging ? "opacity-30" : ""} ${isMoving ? "animate-pulse" : ""}`}
      >
        <OpportunityCardBody opportunity={opportunity} today={today} />
      </article>
      {/* Sibling, not child: the draggable card already has role="button". */}
      <button
        type="button"
        onClick={() => onOpen(opportunity.id)}
        className="sr-only focus:not-sr-only focus:mt-1 focus:block focus:text-xs focus:text-nobre-700 focus:underline"
      >
        Abrir detalhes de {opportunity.code}
      </button>
    </div>
  );
}
