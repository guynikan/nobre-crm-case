import type { AttentionReason, CalendarDate, ReminderStatus, Stage } from "@nobre/contracts";
import type { FollowUpCandidate, OpenReminderRef, ReminderToCreate } from "@nobre/domain";
import type { DbClient } from "../../db/pool.js";
import { priorityRankSql, type AttentionContext } from "../../shared/attention-sql.js";

export type ReminderResolution = "CONTACT_REGISTERED" | "OPPORTUNITY_FINAL" | "NO_LONGER_NEEDED";

export interface ReminderRow {
  id: string;
  opportunity_id: string;
  opportunity_code: string;
  company_name: string;
  seller_name: string | null;
  reason: AttentionReason;
  days_since_last_contact: number | null;
  due_on: CalendarDate;
  created_at: Date;
  resolved_at: Date | null;
}

/** Closes the open reminder of one opportunity, if any. Safe to call when there is none. */
export async function resolveRemindersFor(
  db: DbClient,
  opportunityId: string,
  resolution: ReminderResolution,
  at: Date,
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE follow_up_reminders SET resolved_at = $3, resolution = $2
     WHERE opportunity_id = $1 AND resolved_at IS NULL`,
    [opportunityId, resolution, at],
  );
  return rowCount ?? 0;
}

export async function resolveReminder(db: DbClient, reminderId: string, resolution: ReminderResolution, at: Date) {
  await db.query(
    `UPDATE follow_up_reminders SET resolved_at = $3, resolution = $2
     WHERE id = $1 AND resolved_at IS NULL`,
    [reminderId, resolution, at],
  );
}

export async function listCandidates(db: DbClient): Promise<FollowUpCandidate[]> {
  const { rows } = await db.query<{ id: string; stage: Stage; last_contact_on: CalendarDate | null }>(
    "SELECT id, stage, last_contact_on FROM opportunities",
  );
  return rows.map((row) => ({ opportunityId: row.id, stage: row.stage, lastContactOn: row.last_contact_on }));
}

export async function listOpenReminderRefs(db: DbClient): Promise<OpenReminderRef[]> {
  const { rows } = await db.query<{ id: string; opportunity_id: string }>(
    "SELECT id, opportunity_id FROM follow_up_reminders WHERE resolved_at IS NULL",
  );
  return rows.map((row) => ({ reminderId: row.id, opportunityId: row.opportunity_id }));
}

/**
 * Inserts a reminder unless the opportunity already has an open one.
 * The partial unique index is the last line of defense against duplicates.
 */
export async function insertReminder(db: DbClient, reminder: ReminderToCreate): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO follow_up_reminders (opportunity_id, reason, days_since_last_contact, due_on)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (opportunity_id) WHERE resolved_at IS NULL DO NOTHING
     RETURNING id`,
    [reminder.opportunityId, reminder.reason, reminder.daysSinceLastContact, reminder.dueOn],
  );
  return rows[0]?.id ?? null;
}

export async function countOpenReminders(db: DbClient): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM follow_up_reminders WHERE resolved_at IS NULL",
  );
  return rows[0]!.total;
}

const SELECT_REMINDER = `
  SELECT r.id, r.opportunity_id, o.code AS opportunity_code, o.company_name, s.name AS seller_name,
         r.reason, r.days_since_last_contact, r.due_on, r.created_at, r.resolved_at
  FROM follow_up_reminders r
  JOIN opportunities o ON o.id = r.opportunity_id
  LEFT JOIN sellers s ON s.id = o.seller_id`;

export async function listReminders(
  db: DbClient,
  filters: { status: ReminderStatus; sellerId?: string | undefined },
  attention: AttentionContext,
): Promise<ReminderRow[]> {
  const params: unknown[] = [];
  const where = [filters.status === "OPEN" ? "r.resolved_at IS NULL" : "r.resolved_at IS NOT NULL"];
  if (filters.sellerId) {
    params.push(filters.sellerId);
    where.push(`o.seller_id = $${params.length}`);
  }
  // Open reminders follow the same gates as the board, so both surfaces agree on what is
  // most urgent; the day count only breaks ties inside a gate. Resolved ones are history.
  let order: string;
  if (filters.status === "OPEN") {
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const rank = priorityRankSql(bind(attention.today), bind(attention.thresholdDays), bind(attention.eventHorizonDays));
    order = `${rank} ASC, r.days_since_last_contact DESC NULLS FIRST, o.code`;
  } else {
    order = "r.resolved_at DESC, o.code";
  }
  const { rows } = await db.query<ReminderRow>(
    `${SELECT_REMINDER} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 500`,
    params,
  );
  return rows;
}

export async function listRemindersByIds(db: DbClient, ids: readonly string[]): Promise<ReminderRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<ReminderRow>(`${SELECT_REMINDER} WHERE r.id = ANY($1::uuid[])`, [ids]);
  return rows;
}

export async function markNotified(db: DbClient, ids: readonly string[], at: Date) {
  if (ids.length === 0) return;
  await db.query("UPDATE follow_up_reminders SET notified_at = $2 WHERE id = ANY($1::uuid[])", [ids, at]);
}
