import type {
  CreateOpportunityBody,
  Opportunity,
  OpportunityPage,
  RegisterContactBody,
  StageHistoryEntry,
  StageTransitionBody,
  UpdateOpportunityBody,
} from "@nobre/contracts";
import { createOpportunityBodySchema, isFinalStage } from "@nobre/contracts";
import { daysBetween, evaluateAttention, evaluateQuoteInvariant, evaluateTransition } from "@nobre/domain";
import { withTransaction, type Db, type DbClient } from "../../db/pool.js";
import type { Clock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import { resolveRemindersFor } from "../follow-up/follow-up.repository.js";
import * as repo from "./opportunity.repository.js";

export interface OpportunityServiceDeps {
  db: Db;
  clock: Clock;
  attentionThresholdDays: number;
}

export type OpportunityService = ReturnType<typeof createOpportunityService>;

export function createOpportunityService({ db, clock, attentionThresholdDays }: OpportunityServiceDeps) {
  const attentionContext = () => ({ today: clock.today(), thresholdDays: attentionThresholdDays });

  function toOpportunity(row: repo.OpportunityRow, items: repo.GiftItemRow[]): Opportunity {
    return {
      id: row.id,
      code: row.code,
      companyName: row.company_name,
      seller: row.seller_id ? { id: row.seller_id, name: row.seller_name ?? "" } : null,
      estimatedValueCents: row.estimated_value_cents,
      items: items.map(({ id, name, quantity }) => ({ id, name, quantity })),
      lastContactOn: row.last_contact_on,
      proposalValidUntil: row.proposal_valid_until,
      eventDate: row.event_date,
      stage: row.stage,
      lostReason: row.lost_reason,
      version: row.version,
      isSynthetic: row.is_synthetic,
      attention: evaluateAttention(
        { stage: row.stage, lastContactOn: row.last_contact_on },
        clock.today(),
        attentionThresholdDays,
      ),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async function load(client: DbClient, id: string): Promise<Opportunity> {
    const row = await repo.findOpportunity(client, id);
    if (!row) throw new AppError("NOT_FOUND");
    return toOpportunity(row, await repo.listItems(client, [id]));
  }

  /** Locks the row for the rest of the transaction and checks the client saw the latest version. */
  async function lockForWrite(client: DbClient, id: string, expectedVersion?: number) {
    const row = await repo.findOpportunity(client, id, { forUpdate: true });
    if (!row) throw new AppError("NOT_FOUND");
    if (expectedVersion !== undefined && row.version !== expectedVersion) {
      throw new AppError("VERSION_CONFLICT", `Versão atual: ${row.version}.`);
    }
    return row;
  }

  async function assertSeller(client: DbClient, sellerId: string | null | undefined) {
    if (sellerId && !(await repo.sellerExists(client, sellerId))) {
      throw new AppError("VALIDATION_FAILED", "Vendedor não encontrado.");
    }
  }

  return {
    async list(filters: repo.ListFilters): Promise<OpportunityPage> {
      const { rows, total } = await repo.listOpportunities(db, filters, attentionContext());
      const items = await repo.listItems(db, rows.map((row) => row.id));
      const itemsByOpportunity = Map.groupBy(items, (item) => item.opportunity_id);
      return {
        data: rows.map((row) => toOpportunity(row, itemsByOpportunity.get(row.id) ?? [])),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
      };
    },

    get: (id: string) => load(db, id),

    async create(body: CreateOpportunityBody): Promise<Opportunity> {
      const data = createOpportunityBodySchema.parse(body);
      return withTransaction(db, async (client) => {
        await assertSeller(client, data.sellerId);
        const id = await repo.insertOpportunity(client, data);
        await repo.replaceItems(client, id, data.items);
        await repo.insertStageHistory(client, {
          opportunityId: id,
          fromStage: null,
          toStage: "FIRST_CONTACT",
          lostReason: null,
          source: "USER",
        });
        return load(client, id);
      });
    },

    async update(id: string, body: UpdateOpportunityBody): Promise<Opportunity> {
      return withTransaction(db, async (client) => {
        const current = await lockForWrite(client, id, body.expectedVersion);
        if (isFinalStage(current.stage)) throw new AppError("OPPORTUNITY_IS_FINAL");
        await assertSeller(client, body.sellerId);

        const next = {
          companyName: body.companyName ?? current.company_name,
          sellerId: body.sellerId !== undefined ? body.sellerId : current.seller_id,
          estimatedValueCents:
            body.estimatedValueCents !== undefined ? body.estimatedValueCents : current.estimated_value_cents,
          proposalValidUntil:
            body.proposalValidUntil !== undefined ? body.proposalValidUntil : current.proposal_valid_until,
          eventDate: body.eventDate !== undefined ? body.eventDate : current.event_date,
        };
        const itemCount = body.items?.length ?? (await repo.listItems(client, [id])).length;
        const verdict = evaluateQuoteInvariant({
          stage: current.stage,
          estimatedValueCents: next.estimatedValueCents,
          itemCount,
        });
        if (!verdict.allowed) throw new AppError(verdict.code);

        await repo.updateCommercialData(client, id, next);
        if (body.items) await repo.replaceItems(client, id, body.items);
        return load(client, id);
      });
    },

    async transition(id: string, body: StageTransitionBody): Promise<Opportunity> {
      return withTransaction(db, async (client) => {
        const current = await lockForWrite(client, id, body.expectedVersion);
        const items = await repo.listItems(client, [id]);
        const verdict = evaluateTransition(
          { stage: current.stage, estimatedValueCents: current.estimated_value_cents, itemCount: items.length },
          body,
        );
        if (!verdict.allowed) throw new AppError(verdict.code);

        const lostReason = body.toStage === "LOST" ? body.lostReason!.trim() : null;
        await repo.updateStage(client, id, body.toStage, lostReason);
        // Same transaction: a stage never changes without its history entry, and vice versa.
        await repo.insertStageHistory(client, {
          opportunityId: id,
          fromStage: current.stage,
          toStage: body.toStage,
          lostReason,
          source: "USER",
        });
        if (isFinalStage(body.toStage)) {
          await resolveRemindersFor(client, id, "OPPORTUNITY_FINAL", clock.now());
        }
        return load(client, id);
      });
    },

    async history(id: string): Promise<StageHistoryEntry[]> {
      if (!(await repo.findOpportunity(db, id))) throw new AppError("NOT_FOUND");
      const rows = await repo.listStageHistory(db, id);
      return rows.map((row) => ({
        id: row.id,
        opportunityId: row.opportunity_id,
        fromStage: row.from_stage,
        toStage: row.to_stage,
        lostReason: row.lost_reason,
        source: row.source,
        changedAt: row.changed_at.toISOString(),
      }));
    },

    async registerContact(id: string, body: RegisterContactBody): Promise<Opportunity> {
      if (daysBetween(clock.today(), body.contactedOn) > 0) throw new AppError("CONTACT_IN_FUTURE");
      return withTransaction(db, async (client) => {
        const current = await lockForWrite(client, id);
        if (isFinalStage(current.stage)) throw new AppError("OPPORTUNITY_IS_FINAL");
        await repo.insertContact(client, id, body.contactedOn, body.note ?? null);

        const updated = await load(client, id);
        // Closing the reminder right away keeps the seller's list honest without waiting for the next run.
        if (!updated.attention.needsAttention) {
          await resolveRemindersFor(client, id, "CONTACT_REGISTERED", clock.now());
        }
        return updated;
      });
    },
  };
}
