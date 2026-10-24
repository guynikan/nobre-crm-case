import { ATTENTION_PRIORITIES, type Stage } from "@nobre/contracts";
import { attentionPriority, DEFAULT_EVENT_HORIZON_DAYS } from "@nobre/domain";
import { describe, expect, it, afterAll } from "vitest";
import { createPool } from "../src/db/pool.js";
import { priorityRankSql } from "../src/shared/attention-sql.js";

const url = process.env.TEST_DATABASE_URL;
const TODAY = "2026-10-24";
const THRESHOLD = 2;

/** The rank priorityRankSql assigns: the position in ATTENTION_PRIORITIES, and one past the end for "not due". */
function rankOf(priority: string | null): number {
  return priority === null ? ATTENTION_PRIORITIES.length + 1 : ATTENTION_PRIORITIES.indexOf(priority as never) + 1;
}

interface Candidate {
  stage: Stage;
  lastContactOn: string | null;
  proposalValidUntil: string | null;
  eventDate: string | null;
}

const CANDIDATES: { why: string; row: Candidate }[] = [
  { why: "never contacted, nothing else known", row: { stage: "FIRST_CONTACT", lastContactOn: null, proposalValidUntil: null, eventDate: null } },
  { why: "never contacted outranks every other signal", row: { stage: "FIRST_CONTACT", lastContactOn: null, proposalValidUntil: "2026-01-01", eventDate: "2026-10-25" } },
  { why: "event today", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: null, eventDate: TODAY } },
  { why: "event on the horizon edge", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: null, eventDate: "2026-10-31" } },
  { why: "event one day past the horizon", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: null, eventDate: "2026-11-01" } },
  { why: "event already happened", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: null, eventDate: "2026-10-23" } },
  { why: "imminent event beats an expired proposal", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: "2026-10-01", eventDate: "2026-10-25" } },
  { why: "proposal expired yesterday", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: "2026-10-23", eventDate: null } },
  { why: "proposal expiring today is not expired", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: TODAY, eventDate: null } },
  { why: "overdue with no deadline at stake", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-01", proposalValidUntil: null, eventDate: null } },
  { why: "exactly on the threshold", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-22", proposalValidUntil: null, eventDate: null } },
  { why: "contacted today is not due, whatever is pending", row: { stage: "FOLLOW_UP", lastContactOn: TODAY, proposalValidUntil: "2026-01-01", eventDate: "2026-10-25" } },
  { why: "one day short of the threshold", row: { stage: "FOLLOW_UP", lastContactOn: "2026-10-23", proposalValidUntil: null, eventDate: null } },
  { why: "a final stage is never due", row: { stage: "CLOSING", lastContactOn: null, proposalValidUntil: "2026-01-01", eventDate: "2026-10-25" } },
  { why: "a lost deal is never due", row: { stage: "LOST", lastContactOn: "2026-01-01", proposalValidUntil: "2026-01-01", eventDate: "2026-10-25" } },
];

// attentionPriority exists twice: in TypeScript, and mirrored in SQL so the database can
// order and paginate. Nothing but this test stops the two from drifting apart.
describe.skipIf(!url)("attentionPriority: the SQL mirror agrees with the domain rule", () => {
  const db = createPool(url ?? "");
  afterAll(() => db.end());

  it.each(CANDIDATES)("$why", async ({ row }) => {
    // VALUES instead of real rows: the mirror is a pure expression, so nothing needs to be written.
    const { rows } = await db.query<{ rank: number }>(
      `WITH o(stage, last_contact_on, proposal_valid_until, event_date) AS (
         VALUES ($1::text, $2::date, $3::date, $4::date)
       )
       SELECT ${priorityRankSql("$5", "$6", "$7")} AS rank FROM o`,
      [row.stage, row.lastContactOn, row.proposalValidUntil, row.eventDate, TODAY, THRESHOLD, DEFAULT_EVENT_HORIZON_DAYS],
    );

    const expected = attentionPriority(row, TODAY, { thresholdDays: THRESHOLD });
    expect(Number(rows[0]!.rank)).toBe(rankOf(expected));
  });
});
