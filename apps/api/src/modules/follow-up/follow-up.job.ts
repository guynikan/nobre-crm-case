import cron from "node-cron";
import type { FollowUpService } from "./follow-up.service.js";

export interface FollowUpJobOptions {
  expression: string;
  timeZone: string;
  service: FollowUpService;
  log: { error: (obj: object, msg: string) => void };
}

/** Schedules the follow-up run. noOverlap skips a tick while the previous run is still going. */
export function scheduleFollowUpJob({ expression, timeZone, service, log }: FollowUpJobOptions) {
  if (!cron.validate(expression)) throw new Error(`invalid FOLLOW_UP_CRON expression: ${expression}`);
  return cron.schedule(
    expression,
    async () => {
      try {
        await service.run();
      } catch (error) {
        log.error({ err: error }, "scheduled follow-up run failed");
      }
    },
    { name: "follow-up", timezone: timeZone, noOverlap: true },
  );
}
