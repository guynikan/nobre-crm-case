import {
  isFinalStage,
  type Attention,
  type AttentionCheck,
  type AttentionPriority,
  type CalendarDate,
  type Stage,
} from "@nobre/contracts";
import { daysBetween } from "./calendar-date";

/** Business rule set by the product owner: 2 or more days without contact needs attention. */
export const DEFAULT_ATTENTION_THRESHOLD_DAYS = 2;

/** An event this close cannot absorb another day of delay: production still has to happen. */
export const DEFAULT_EVENT_HORIZON_DAYS = 7;

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
): AttentionCheck {
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

export interface PriorityInput extends AttentionInput {
  proposalValidUntil: CalendarDate | null;
  eventDate: CalendarDate | null;
}

export interface PriorityOptions {
  thresholdDays?: number;
  eventHorizonDays?: number;
}

/**
 * Ranks what already needs attention, so a seller knows which deal to open first
 * when the day does not fit all of them.
 *
 * This never widens the set: a deal contacted today stays out even with an event
 * tomorrow, because somebody is demonstrably already on it. `evaluateAttention`
 * decides *whether* a deal is due; this decides *in which order*.
 *
 * The order encodes how recoverable each situation is. Nobody has called an
 * untouched lead yet, so the sale has not started. An imminent event is a hard
 * date in the client's world: miss it and there is no production time left. An
 * expired proposal is the mildest of the three, since a quote can be reissued.
 */
export function attentionPriority(
  opportunity: PriorityInput,
  today: CalendarDate,
  options: PriorityOptions = {},
): AttentionPriority | null {
  const { thresholdDays = DEFAULT_ATTENTION_THRESHOLD_DAYS, eventHorizonDays = DEFAULT_EVENT_HORIZON_DAYS } = options;
  if (!evaluateAttention(opportunity, today, thresholdDays).needsAttention) return null;

  if (opportunity.lastContactOn === null) return "UNTOUCHED";

  const daysToEvent = opportunity.eventDate === null ? null : daysBetween(today, opportunity.eventDate);
  if (daysToEvent !== null && daysToEvent >= 0 && daysToEvent <= eventHorizonDays) return "EVENT_IMMINENT";

  if (opportunity.proposalValidUntil !== null && daysBetween(opportunity.proposalValidUntil, today) > 0) {
    return "PROPOSAL_EXPIRED";
  }
  return "OVERDUE_CONTACT";
}

/** The check and its ranking together, which is what the board renders per card. */
export function evaluateAttentionWithPriority(
  opportunity: PriorityInput,
  today: CalendarDate,
  thresholdDays?: number,
): Attention {
  return {
    ...evaluateAttention(opportunity, today, thresholdDays),
    priority: attentionPriority(opportunity, today, { thresholdDays }),
  };
}
