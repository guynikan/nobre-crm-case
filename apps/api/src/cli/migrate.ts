import { loadConfig } from "../config.js";
import { migrate } from "../db/migrate.js";
import { createPool } from "../db/pool.js";

const db = createPool(loadConfig().databaseUrl);
try {
  await migrate(db);
  console.log("migrations up to date");
} finally {
  await db.end();
}
