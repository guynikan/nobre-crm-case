import { isFinalStage, type Attention, type CalendarDate, type Stage } from "@nobre/contracts";
import { daysBetween } from "./calendar-date";

/** Business rule set by the product owner: 2 or more days without contact needs attention. */
export const DEFAULT_ATTENTION_THRESHOLD_DAYS = 2;

export interface AttentionInput {
  stage: Stage;
  lastContactOn: CalendarDate | null;
}

/**
 * Decides whether a seller should act on an opportunity today.
 * Final stages never need attention; a missing contact date always does,
 * because it means nobody has talked to the lead yet.
 */
export function evaluateAttention(
  opportunity: AttentionInput,
  today: CalendarDate,
  thresholdDays: number = DEFAULT_ATTENTION_THRESHOLD_DAYS,
): Attention {
  if (isFinalStage(opportunity.stage)) {
    return { needsAttention: false, reason: null, daysSinceLastContact: null };
  }
  if (opportunity.lastContactOn === null) {
    return { needsAttention: true, reason: "NO_CONTACT_RECORDED", daysSinceLastContact: null };
  }
  // A contact dated in the future (bad data) counts as "today": no negative ages.
  const days = Math.max(0, daysBetween(opportunity.lastContactOn, today));
  return days >= thresholdDays
    ? { needsAttention: true, reason: "DAYS_WITHOUT_CONTACT", daysSinceLastContact: days }
    : { needsAttention: false, reason: null, daysSinceLastContact: days };
}
