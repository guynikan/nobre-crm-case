import type { CalendarDate, GiftItemInput, Stage } from "@nobre/contracts";
import type { DbClient } from "../../db/pool.js";
import { needsAttentionSql, priorityRankSql, type AttentionContext } from "../../shared/attention-sql.js";

export interface OpportunityRow {
  id: string;
  code: string;
  company_name: string;
  seller_id: string | null;
  seller_name: string | null;
  estimated_value_cents: number | null;
  last_contact_on: CalendarDate | null;
  proposal_valid_until: CalendarDate | null;
  event_date: CalendarDate | null;
  stage: Stage;
  lost_reason: string | null;
  version: number;
  is_synthetic: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface GiftItemRow {
  id: string;
  opportunity_id: string;
  name: string;
  quantity: number;
}

export interface ListFilters {
  search?: string | undefined;
  stage?: Stage | undefined;
  sellerId?: string | undefined;
  needsAttention?: boolean | undefined;
  page: number;
  pageSize: number;
}

const SELECT_OPPORTUNITY = `
  SELECT o.id, o.code, o.company_name, o.seller_id, s.name AS seller_name,
         o.estimated_value_cents, o.last_contact_on, o.proposal_valid_until, o.event_date,
         o.stage, o.lost_reason, o.version, o.is_synthetic, o.created_at, o.updated_at
  FROM opportunities o
  LEFT JOIN sellers s ON s.id = o.seller_id`;

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Collects positional parameters and returns their placeholders. */
class Params {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function buildWhere(params: Params, filters: ListFilters, attention: AttentionContext): string {
  const where: string[] = [];
  if (filters.search) {
    const term = params.add(`%${escapeLike(filters.search)}%`);
    where.push(`(o.company_name ILIKE ${term} OR o.code ILIKE ${term})`);
  }
  if (filters.stage) where.push(`o.stage = ${params.add(filters.stage)}`);
  if (filters.sellerId) where.push(`o.seller_id = ${params.add(filters.sellerId)}`);
  if (filters.needsAttention !== undefined) {
    const condition = needsAttentionSql(params.add(attention.today), params.add(attention.thresholdDays));
    where.push(filters.needsAttention ? condition : `NOT ${condition}`);
  }
  return where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
}

export async function listOpportunities(
  db: DbClient,
  filters: ListFilters,
  attention: AttentionContext,
): Promise<{ rows: OpportunityRow[]; total: number }> {
  const countParams = new Params();
  const total = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM opportunities o ${buildWhere(countParams, filters, attention)}`,
    countParams.values,
  );

  // Sellers see first the most urgent of what needs action, then the oldest contacts,
  // then the biggest deals. The ranking is the one attentionPriority assigns.
  const params = new Params();
  const whereSql = buildWhere(params, filters, attention);
  const priorityOrder = priorityRankSql(
    params.add(attention.today),
    params.add(attention.thresholdDays),
    params.add(attention.eventHorizonDays),
  );
  const { rows } = await db.query<OpportunityRow>(
    `${SELECT_OPPORTUNITY}
     ${whereSql}
     ORDER BY ${priorityOrder} ASC, o.last_contact_on ASC NULLS FIRST,
              o.estimated_value_cents DESC NULLS LAST, o.code
     LIMIT ${params.add(filters.pageSize)} OFFSET ${params.add((filters.page - 1) * filters.pageSize)}`,
    params.values,
  );
  return { rows, total: total.rows[0]!.total };
}

export async function findOpportunity(
  db: DbClient,
  id: string,
  options: { forUpdate?: boolean } = {},
): Promise<OpportunityRow | null> {
  const { rows } = await db.query<OpportunityRow>(
    `${SELECT_OPPORTUNITY} WHERE o.id = $1 ${options.forUpdate ? "FOR UPDATE OF o" : ""}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listItems(db: DbClient, opportunityIds: readonly string[]): Promise<GiftItemRow[]> {
  if (opportunityIds.length === 0) return [];
  const { rows } = await db.query<GiftItemRow>(
    `SELECT id, opportunity_id, name, quantity FROM gift_items
     WHERE opportunity_id = ANY($1::uuid[]) ORDER BY opportunity_id, position`,
    [opportunityIds],
  );
  return rows;
}

export async function replaceItems(db: DbClient, opportunityId: string, items: readonly GiftItemInput[]) {
  await db.query("DELETE FROM gift_items WHERE opportunity_id = $1", [opportunityId]);
  for (const [position, item] of items.entries()) {
    await db.query(
      "INSERT INTO gift_items (opportunity_id, name, quantity, position) VALUES ($1, $2, $3, $4)",
      [opportunityId, item.name, item.quantity, position],
    );
  }
}

export async function insertOpportunity(
  db: DbClient,
  data: {
    companyName: string;
    sellerId: string | null;
    estimatedValueCents: number | null;
    lastContactOn: CalendarDate | null;
    proposalValidUntil: CalendarDate | null;
    eventDate: CalendarDate | null;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO opportunities
       (code, company_name, seller_id, estimated_value_cents, last_contact_on, proposal_valid_until, event_date)
     VALUES ('OPP-' || nextval('opportunity_code_seq'), $1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      data.companyName,
      data.sellerId,
      data.estimatedValueCents,
      data.lastContactOn,
      data.proposalValidUntil,
      data.eventDate,
    ],
  );
  return rows[0]!.id;
}

export async function updateCommercialData(
  db: DbClient,
  id: string,
  data: {
    companyName: string;
    sellerId: string | null;
    estimatedValueCents: number | null;
    proposalValidUntil: CalendarDate | null;
    eventDate: CalendarDate | null;
  },
): Promise<void> {
  await db.query(
    `UPDATE opportunities
     SET company_name = $2, seller_id = $3, estimated_value_cents = $4,
         proposal_valid_until = $5, event_date = $6, version = version + 1, updated_at = now()
     WHERE id = $1`,
    [id, data.companyName, data.sellerId, data.estimatedValueCents, data.proposalValidUntil, data.eventDate],
  );
}

export async function updateStage(db: DbClient, id: string, stage: Stage, lostReason: string | null) {
  await db.query(
    `UPDATE opportunities SET stage = $2, lost_reason = $3, version = version + 1, updated_at = now()
     WHERE id = $1`,
    [id, stage, lostReason],
  );
}

export async function insertStageHistory(
  db: DbClient,
  entry: { opportunityId: string; fromStage: Stage | null; toStage: Stage; lostReason: string | null; source: "USER" | "SEED" },
) {
  await db.query(
    `INSERT INTO stage_history (opportunity_id, from_stage, to_stage, lost_reason, source)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.opportunityId, entry.fromStage, entry.toStage, entry.lostReason, entry.source],
  );
}

export interface StageHistoryRow {
  id: string;
  opportunity_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  lost_reason: string | null;
  source: "USER" | "SEED";
  changed_at: Date;
}

export async function listStageHistory(db: DbClient, opportunityId: string): Promise<StageHistoryRow[]> {
  const { rows } = await db.query<StageHistoryRow>(
    `SELECT id, opportunity_id, from_stage, to_stage, lost_reason, source, changed_at
     FROM stage_history WHERE opportunity_id = $1 ORDER BY changed_at DESC, id`,
    [opportunityId],
  );
  return rows;
}

export async function insertContact(
  db: DbClient,
  opportunityId: string,
  contactedOn: CalendarDate,
  note: string | null,
) {
  await db.query("INSERT INTO contacts (opportunity_id, contacted_on, note) VALUES ($1, $2, $3)", [
    opportunityId,
    contactedOn,
    note,
  ]);
  // Registering an older contact never moves lastContactOn backwards.
  await db.query(
    `UPDATE opportunities
     SET last_contact_on = GREATEST(last_contact_on, $2::date), version = version + 1, updated_at = now()
     WHERE id = $1`,
    [opportunityId, contactedOn],
  );
}

export async function sellerExists(db: DbClient, sellerId: string): Promise<boolean> {
  const { rowCount } = await db.query("SELECT 1 FROM sellers WHERE id = $1", [sellerId]);
  return (rowCount ?? 0) > 0;
}

export interface ContactRow {
  id: string;
  opportunity_id: string;
  contacted_on: CalendarDate;
  note: string | null;
  created_at: Date;
}

export async function listContacts(db: DbClient, opportunityId: string): Promise<ContactRow[]> {
  const { rows } = await db.query<ContactRow>(
    `SELECT id, opportunity_id, contacted_on, note, created_at
     FROM contacts WHERE opportunity_id = $1 ORDER BY contacted_on DESC, created_at DESC`,
    [opportunityId],
  );
  return rows;
}

export async function listSellers(db: DbClient): Promise<{ id: string; name: string }[]> {
  const { rows } = await db.query<{ id: string; name: string }>("SELECT id, name FROM sellers ORDER BY name");
  return rows;
}
