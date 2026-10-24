import type { FollowUpRunResult, Reminder, ReminderStatus } from "@nobre/contracts";
import { DEFAULT_EVENT_HORIZON_DAYS, planFollowUp } from "@nobre/domain";
import { withTransaction, type Db } from "../../db/pool.js";
import type { Clock } from "../../shared/clock.js";
import * as repo from "./follow-up.repository.js";

export interface FollowUpServiceDeps {
  db: Db;
  clock: Clock;
  attentionThresholdDays: number;
  /** Called with the reminders a run created; failures are logged, never undo the run. */
  notify?: (reminders: Reminder[]) => Promise<void>;
  log?: { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };
}

/** Any constant works; it only has to be the same for every process running the job. */
const RUN_LOCK_KEY = 4_815_162_342;

export type FollowUpService = ReturnType<typeof createFollowUpService>;

export function toReminder(row: repo.ReminderRow): Reminder {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunityCode: row.opportunity_code,
    companyName: row.company_name,
    sellerName: row.seller_name,
    reason: row.reason,
    daysSinceLastContact: row.days_since_last_contact,
    dueOn: row.due_on,
    status: row.resolved_at ? "RESOLVED" : "OPEN",
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

export function createFollowUpService({ db, clock, attentionThresholdDays, notify, log }: FollowUpServiceDeps) {
  const attentionContext = () => ({
    today: clock.today(),
    thresholdDays: attentionThresholdDays,
    eventHorizonDays: DEFAULT_EVENT_HORIZON_DAYS,
  });
  return {
    /**
     * One run of the automation. Idempotent: running it again on the same data changes nothing.
     * A transaction-level advisory lock serializes the cron job and manual runs, even across processes.
     */
    async run(): Promise<FollowUpRunResult> {
      const referenceDate = clock.today();
      const now = clock.now();

      const { result, createdIds } = await withTransaction(db, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock($1)", [RUN_LOCK_KEY]);
        const plan = planFollowUp(
          await repo.listCandidates(client),
          await repo.listOpenReminderRefs(client),
          referenceDate,
          attentionThresholdDays,
        );

        const createdIds: string[] = [];
        for (const reminder of plan.toCreate) {
          const id = await repo.insertReminder(client, reminder);
          if (id) createdIds.push(id);
        }
        for (const { reminderId, resolution } of plan.toResolve) {
          await repo.resolveReminder(client, reminderId, resolution, now);
        }
        const result: FollowUpRunResult = {
          referenceDate,
          thresholdDays: attentionThresholdDays,
          created: createdIds.length,
          resolved: plan.toResolve.length,
          open: await repo.countOpenReminders(client),
        };
        return { result, createdIds };
      });

      log?.info(result, "follow-up run finished");
      if (notify && createdIds.length > 0) {
        try {
          await notify((await repo.listRemindersByIds(db, createdIds)).map(toReminder));
          await repo.markNotified(db, createdIds, clock.now());
        } catch (error) {
          log?.error({ err: error }, "follow-up notification failed; reminders stay visible in the CRM");
        }
      }
      return result;
    },

    async list(filters: { status: ReminderStatus; sellerId?: string | undefined }): Promise<Reminder[]> {
      return (await repo.listReminders(db, filters, attentionContext())).map(toReminder);
    },
  };
}

/** Posts new reminders to a webhook (e.g. a chat channel). Optional; the CRM list works without it. */
export function webhookNotifier(url: string) {
  return async (reminders: Reminder[]) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "follow_up.reminders_created", reminders }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`webhook answered ${response.status}`);
  };
}
