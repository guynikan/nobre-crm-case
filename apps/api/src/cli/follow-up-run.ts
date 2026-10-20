import { loadConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import { systemClock } from "../shared/clock.js";
import { createFollowUpService, webhookNotifier } from "../modules/follow-up/follow-up.service.js";

/** CLI entry: runs the automation once and prints the result. */
const config = loadConfig();
const db = createPool(config.databaseUrl);
const service = createFollowUpService({
  db,
  clock: systemClock(config.businessTimeZone, config.businessToday),
  attentionThresholdDays: config.attentionThresholdDays,
  ...(config.followUpWebhookUrl ? { notify: webhookNotifier(config.followUpWebhookUrl) } : {}),
});
try {
  console.log(JSON.stringify(await service.run(), null, 2));
} finally {
  await db.end();
}
