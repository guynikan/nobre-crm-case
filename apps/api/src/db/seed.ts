import { loadConfig } from "../config.js";
import { migrate } from "./migrate.js";
import { createPool, withTransaction, type Db } from "./pool.js";
import type pg from "pg";
import {
  applyCorrections,
  CASE_CORRECTIONS,
  CASE_OPPORTUNITIES_AS_GIVEN,
  CASE_REFERENCE_DATE,
  CASE_SELLERS,
  type SeedOpportunity,
} from "./seed/case-data.js";
import { buildSyntheticOpportunities, SYNTHETIC_SELLERS } from "./seed/synthetic.js";

export const SYNTHETIC_COUNT = 80;

export interface SeedOptions {
  synthetic: boolean;
  /** Anchor for synthetic dates; defaults to the case reference date. */
  referenceDate?: string;
}

/** Wipes business data and loads the case (plus, optionally, synthetic data). Dev/test only. */
export async function seed(db: Db, options: SeedOptions): Promise<{ case: number; synthetic: number }> {
  const caseRows = applyCorrections(CASE_OPPORTUNITIES_AS_GIVEN, CASE_CORRECTIONS);
  const syntheticRows = options.synthetic
    ? buildSyntheticOpportunities(SYNTHETIC_COUNT, options.referenceDate ?? CASE_REFERENCE_DATE)
    : [];

  await withTransaction(db, async (client) => {
    await client.query(
      "TRUNCATE follow_up_reminders, contacts, stage_history, gift_items, opportunities, sellers RESTART IDENTITY CASCADE",
    );
    await client.query("ALTER SEQUENCE opportunity_code_seq RESTART WITH 5001");

    const sellerNames = [...CASE_SELLERS, ...(options.synthetic ? SYNTHETIC_SELLERS : [])];
    const sellerIds = new Map<string, string>();
    for (const name of sellerNames) {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO sellers (name) VALUES ($1) RETURNING id",
        [name],
      );
      sellerIds.set(name, rows[0]!.id);
    }

    for (const row of caseRows) await insertOpportunity(client, row, sellerIds, false);
    for (const row of syntheticRows) await insertOpportunity(client, row, sellerIds, true);
  });

  return { case: caseRows.length, synthetic: syntheticRows.length };
}

async function insertOpportunity(
  client: pg.PoolClient,
  row: SeedOpportunity,
  sellerIds: Map<string, string>,
  isSynthetic: boolean,
): Promise<void> {
  const sellerId = row.sellerName ? (sellerIds.get(row.sellerName) ?? null) : null;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO opportunities
       (code, company_name, seller_id, estimated_value_cents, last_contact_on,
        proposal_valid_until, event_date, stage, lost_reason, is_synthetic)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      row.code,
      row.companyName,
      sellerId,
      row.estimatedValueCents,
      row.lastContactOn,
      row.proposalValidUntil,
      row.eventDate,
      row.stage,
      row.lostReason,
      isSynthetic,
    ],
  );
  const opportunityId = rows[0]!.id;

  for (const [position, item] of row.items.entries()) {
    await client.query(
      "INSERT INTO gift_items (opportunity_id, name, quantity, position) VALUES ($1, $2, $3, $4)",
      [opportunityId, item.name, item.quantity, position],
    );
  }
  // The stages before the import are unknown, so history starts at the imported stage.
  await client.query(
    `INSERT INTO stage_history (opportunity_id, from_stage, to_stage, lost_reason, source)
     VALUES ($1, NULL, $2, $3, 'SEED')`,
    [opportunityId, row.stage, row.lostReason],
  );
  if (row.lastContactOn) {
    await client.query(
      "INSERT INTO contacts (opportunity_id, contacted_on, note) VALUES ($1, $2, $3)",
      [opportunityId, row.lastContactOn, "Último contato informado na carga inicial"],
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const db = createPool(config.databaseUrl);
  const synthetic = process.argv.includes("--synthetic");
  migrate(db)
    .then(() => seed(db, { synthetic, referenceDate: config.businessToday ?? CASE_REFERENCE_DATE }))
    .then((counts) => console.log(`seeded ${counts.case} case + ${counts.synthetic} synthetic opportunities`))
    .finally(() => db.end());
}
