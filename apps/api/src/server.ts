import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { scheduleFollowUpJob } from "./modules/follow-up/follow-up.job.js";
import { systemClock } from "./shared/clock.js";

const config = loadConfig();
const db = createPool(config.databaseUrl);
const clock = systemClock(config.businessTimeZone, config.businessToday);
const { app, followUp } = await buildApp({ config, db, clock });

const job = scheduleFollowUpJob({
  expression: config.followUpCron,
  timeZone: config.businessTimeZone,
  service: followUp,
  log: app.log,
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await job.stop();
  await app.close();
  await db.end();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.port, host: config.host });
// Run once at boot so reminders exist right away instead of at the first cron tick.
followUp.run().catch((error) => app.log.error({ err: error }, "initial follow-up run failed"));
