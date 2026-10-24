"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { STAGE_LABELS } from "@/shared/format";
import { ScrollFade } from "@/shared/ui/scroll-fade";
import { useToast } from "@/shared/ui/toast";
import { MOVE_STAGE_KEY, useMoveStage, type MoveStageInput } from "./api";
import { BoardColumn, type DropState } from "./board-column";
import { DraggableCard } from "./draggable-card";
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
  const dropStateFor = (stage: Stage): DropState => {
    if (allowedTargets === null) return "idle";
    if (allowedTargets.has(stage)) return "allowed";
    return active?.stage === stage ? "origin" : "blocked";
  };

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
      <ScrollFade
        className="min-h-0 flex-1"
        contentClassName="board-surface flex h-full gap-3 px-6 pb-6"
        contentKey={opportunities.length}
      >
        {BOARD_COLUMNS.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            opportunities={byStage.get(stage) ?? []}
            dropState={dropStateFor(stage)}
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
      </ScrollFade>

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
