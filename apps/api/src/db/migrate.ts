import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { withTransaction, type Db } from "./pool.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

/** Applies pending SQL migrations in file-name order, each in its own transaction. */
export async function migrate(db: Db, log: (message: string) => void = console.log): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const applied = new Set(
    (await db.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await withTransaction(db, async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    log(`applied ${file}`);
  }
}
