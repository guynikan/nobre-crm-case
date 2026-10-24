import type { CalendarDate } from "@nobre/contracts";

/** Context the attention rules need; kept in SQL so filtering, ordering and paging happen in the database. */
export interface AttentionContext {
  today: CalendarDate;
  thresholdDays: number;
  eventHorizonDays: number;
}

/** SQL mirror of evaluateAttention in @nobre/domain; placeholders are bound per query. */
export function needsAttentionSql(today: string, threshold: string): string {
  return `(o.stage NOT IN ('CLOSING', 'LOST')
    AND (o.last_contact_on IS NULL OR o.last_contact_on <= ${today}::date - ${threshold}::int))`;
}

/**
 * SQL mirror of attentionPriority: lower sorts first, and one past the last priority
 * means "not due". Kept in the same order as ATTENTION_PRIORITIES so the two cannot
 * drift apart silently; attention-sql-mirror.test.ts pins them together.
 *
 * Every query using it must expose the opportunity as `o`.
 */
export function priorityRankSql(today: string, threshold: string, horizon: string): string {
  return `CASE
    WHEN NOT ${needsAttentionSql(today, threshold)} THEN 5
    WHEN o.last_contact_on IS NULL THEN 1
    WHEN o.event_date IS NOT NULL
     AND o.event_date >= ${today}::date
     AND o.event_date <= ${today}::date + ${horizon}::int THEN 2
    WHEN o.proposal_valid_until IS NOT NULL AND o.proposal_valid_until < ${today}::date THEN 3
    ELSE 4
  END`;
}
