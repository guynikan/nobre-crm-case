import { loadConfig } from "../config.js";
import { migrate } from "../db/migrate.js";
import { createPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import { CASE_REFERENCE_DATE } from "../db/seed/case-data.js";

const config = loadConfig();
const db = createPool(config.databaseUrl);
try {
  await migrate(db);
  const counts = await seed(db, {
    synthetic: process.argv.includes("--synthetic"),
    referenceDate: config.businessToday ?? CASE_REFERENCE_DATE,
  });
  console.log(`seeded ${counts.case} case + ${counts.synthetic} synthetic opportunities`);
} finally {
  await db.end();
}
