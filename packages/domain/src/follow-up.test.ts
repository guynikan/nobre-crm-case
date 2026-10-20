import { describe, expect, it } from "vitest";
import { planFollowUp, type FollowUpCandidate } from "./follow-up";

const TODAY = "2026-10-15";
const THRESHOLD = 2;

const candidate = (
  opportunityId: string,
  stage: FollowUpCandidate["stage"],
  lastContactOn: string | null,
): FollowUpCandidate => ({ opportunityId, stage, lastContactOn });

describe("planFollowUp", () => {
  it("creates one reminder per opportunity that needs attention", () => {
    const plan = planFollowUp(
      [
        candidate("a", "FOLLOW_UP", "2026-10-02"),
        candidate("b", "FORECAST", "2026-10-15"),
        candidate("c", "FIRST_CONTACT", null),
      ],
      [],
      TODAY,
      THRESHOLD,
    );
    expect(plan.toResolve).toEqual([]);
    expect(plan.toCreate).toEqual([
      { opportunityId: "a", reason: "DAYS_WITHOUT_CONTACT", daysSinceLastContact: 13, dueOn: TODAY },
      { opportunityId: "c", reason: "NO_CONTACT_RECORDED", daysSinceLastContact: null, dueOn: TODAY },
    ]);
  });

  it("is idempotent: an open reminder blocks a duplicate", () => {
    const plan = planFollowUp(
      [candidate("a", "FOLLOW_UP", "2026-10-02")],
      [{ reminderId: "r1", opportunityId: "a" }],
      TODAY,
      THRESHOLD,
    );
    expect(plan).toEqual({ toCreate: [], toResolve: [] });
  });

  it("closes a reminder once a recent contact is registered", () => {
    const plan = planFollowUp(
      [candidate("a", "FOLLOW_UP", "2026-10-15")],
      [{ reminderId: "r1", opportunityId: "a" }],
      TODAY,
      THRESHOLD,
    );
    expect(plan).toEqual({ toCreate: [], toResolve: [{ reminderId: "r1", resolution: "NO_LONGER_NEEDED" }] });
  });

  it.each(["CLOSING", "LOST"] as const)("closes reminders and never creates them for %s", (stage) => {
    const plan = planFollowUp(
      [candidate("a", stage, "2026-09-01"), candidate("b", stage, "2026-09-01")],
      [{ reminderId: "r1", opportunityId: "a" }],
      TODAY,
      THRESHOLD,
    );
    expect(plan).toEqual({ toCreate: [], toResolve: [{ reminderId: "r1", resolution: "OPPORTUNITY_FINAL" }] });
  });
});
