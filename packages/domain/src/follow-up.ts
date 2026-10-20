import { isFinalStage, type AttentionReason, type CalendarDate, type Stage } from "@nobre/contracts";
import { evaluateAttention } from "./attention";

export interface FollowUpCandidate {
  opportunityId: string;
  stage: Stage;
  lastContactOn: CalendarDate | null;
}

export interface OpenReminderRef {
  reminderId: string;
  opportunityId: string;
}

export interface ReminderToCreate {
  opportunityId: string;
  reason: AttentionReason;
  daysSinceLastContact: number | null;
  dueOn: CalendarDate;
}

export type ReminderResolution = "OPPORTUNITY_FINAL" | "NO_LONGER_NEEDED";

export interface ReminderToResolve {
  reminderId: string;
  resolution: ReminderResolution;
}

export interface FollowUpPlan {
  toCreate: ReminderToCreate[];
  toResolve: ReminderToResolve[];
}

/**
 * Decides what one run of the follow-up automation must do.
 *
 * Idempotent by construction: an opportunity that already has an open reminder
 * never gets a second one, so running twice on the same day changes nothing.
 * Reminders whose reason is gone (contact registered, deal finished) are closed.
 */
export function planFollowUp(
  opportunities: readonly FollowUpCandidate[],
  openReminders: readonly OpenReminderRef[],
  today: CalendarDate,
  thresholdDays: number,
): FollowUpPlan {
  const openByOpportunity = new Map(openReminders.map((reminder) => [reminder.opportunityId, reminder]));
  const toCreate: ReminderToCreate[] = [];
  const toResolve: ReminderToResolve[] = [];

  for (const opportunity of opportunities) {
    const open = openByOpportunity.get(opportunity.opportunityId);
    openByOpportunity.delete(opportunity.opportunityId);

    if (isFinalStage(opportunity.stage)) {
      if (open) toResolve.push({ reminderId: open.reminderId, resolution: "OPPORTUNITY_FINAL" });
      continue;
    }

    const attention = evaluateAttention(opportunity, today, thresholdDays);
    if (attention.needsAttention && !open) {
      toCreate.push({
        opportunityId: opportunity.opportunityId,
        reason: attention.reason!,
        daysSinceLastContact: attention.daysSinceLastContact,
        dueOn: today,
      });
    } else if (!attention.needsAttention && open) {
      toResolve.push({ reminderId: open.reminderId, resolution: "NO_LONGER_NEEDED" });
    }
  }

  // Reminders pointing at opportunities that were not evaluated are left untouched:
  // the caller decides the scope of a run, and silence is safer than a wrong close.
  return { toCreate, toResolve };
}
