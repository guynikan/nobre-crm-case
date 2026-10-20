import { isFinalStage, type ErrorCode, type Stage } from "@nobre/contracts";

/**
 * Allowed moves between funnel stages (LOST is handled separately).
 *
 * Forward moves are one step at a time, so no stage is skipped and
 * CLOSING is only reachable from FORECAST.
 * Backward moves are one step at a time between QUOTE_PRESENTATION,
 * FOLLOW_UP and FORECAST: a customer can ask for a revised quote or a
 * forecast can cool down. Going back to FIRST_CONTACT is blocked because a
 * quote already sent cannot be "unsent"; final stages never change.
 */
export const STAGE_TRANSITIONS: Readonly<Record<Stage, readonly Stage[]>> = {
  FIRST_CONTACT: ["QUOTE_PRESENTATION"],
  QUOTE_PRESENTATION: ["FOLLOW_UP"],
  FOLLOW_UP: ["FORECAST", "QUOTE_PRESENTATION"],
  FORECAST: ["CLOSING", "FOLLOW_UP"],
  CLOSING: [],
  LOST: [],
};

/** Stages from QUOTE_PRESENTATION onwards need a value and at least one gift item. */
const STAGES_REQUIRING_QUOTE: readonly Stage[] = [
  "QUOTE_PRESENTATION",
  "FOLLOW_UP",
  "FORECAST",
  "CLOSING",
];

export function stageRequiresQuote(stage: Stage): boolean {
  return STAGES_REQUIRING_QUOTE.includes(stage);
}

export interface TransitionSubject {
  stage: Stage;
  estimatedValueCents: number | null;
  itemCount: number;
}

export interface TransitionRequest {
  toStage: Stage;
  lostReason?: string | undefined;
}

export type TransitionVerdict = { allowed: true } | { allowed: false; code: ErrorCode };

/** Stages an opportunity may move to from its current stage, LOST included. */
export function reachableStages(from: Stage): Stage[] {
  if (isFinalStage(from)) return [];
  return [...STAGE_TRANSITIONS[from], "LOST"];
}

export function evaluateTransition(
  subject: TransitionSubject,
  request: TransitionRequest,
): TransitionVerdict {
  const { stage: from } = subject;
  const { toStage: to } = request;
  const lostReason = request.lostReason?.trim() ?? "";

  if (isFinalStage(from)) return deny("STAGE_IS_FINAL");
  if (from === to) return deny("SAME_STAGE");

  if (to === "LOST") {
    return lostReason.length > 0 ? { allowed: true } : deny("LOST_REASON_REQUIRED");
  }
  if (lostReason.length > 0) return deny("LOST_REASON_NOT_ALLOWED");

  if (!STAGE_TRANSITIONS[from].includes(to)) return deny("TRANSITION_NOT_ALLOWED");

  if (stageRequiresQuote(to)) {
    if (subject.estimatedValueCents === null || subject.estimatedValueCents <= 0) {
      return deny("MISSING_ESTIMATED_VALUE");
    }
    if (subject.itemCount < 1) return deny("MISSING_GIFT_ITEMS");
  }
  return { allowed: true };
}

/**
 * Guards edits so an opportunity that already has a quote cannot lose its value
 * or all of its items, which would break the rule that let it advance.
 */
export function evaluateQuoteInvariant(subject: TransitionSubject): TransitionVerdict {
  if (!stageRequiresQuote(subject.stage)) return { allowed: true };
  if (subject.estimatedValueCents === null || subject.estimatedValueCents <= 0) {
    return deny("ESTIMATED_VALUE_REQUIRED_FOR_STAGE");
  }
  if (subject.itemCount < 1) return deny("ITEMS_REQUIRED_FOR_STAGE");
  return { allowed: true };
}

function deny(code: ErrorCode): TransitionVerdict {
  return { allowed: false, code };
}
