import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { seed } from "../src/db/seed.js";
import { createFollowUpService } from "../src/modules/follow-up/follow-up.service.js";
import { createOpportunityService } from "../src/modules/opportunities/opportunity.service.js";
import { fixedClock, type Clock } from "../src/shared/clock.js";

const url = process.env.TEST_DATABASE_URL;
const THRESHOLD = 2;
// The clock and the seed must agree, or the gaps the assertions below rely on shift.
const TODAY = "2026-10-15";

// Runs the real SQL against a dedicated database: idempotency lives in the schema and the
// transaction, so a pure unit test (see @nobre/domain follow-up.test.ts) is not enough.
describe.skipIf(!url)("follow-up automation (PostgreSQL)", () => {
  const db = createPool(url ?? "");
  let clock: Clock = fixedClock(TODAY);
  const clockProxy: Clock = { now: () => clock.now(), today: () => clock.today() };
  const followUp = createFollowUpService({ db, clock: clockProxy, attentionThresholdDays: THRESHOLD });
  const opportunities = createOpportunityService({ db, clock: clockProxy, attentionThresholdDays: THRESHOLD });

  const openCodes = async () =>
    (await followUp.list({ status: "OPEN" })).map((reminder) => reminder.opportunityCode).sort();
  const idOf = async (code: string) =>
    (await db.query<{ id: string }>("SELECT id FROM opportunities WHERE code = $1", [code])).rows[0]!.id;

  beforeEach(async () => {
    clock = fixedClock(TODAY);
    await migrate(db, () => {});
    await seed(db, { synthetic: false, today: TODAY });
  });

  afterAll(() => db.end());

  it("creates reminders only for open deals with 2+ days without contact on the case data", async () => {
    const result = await followUp.run();
    expect(result).toEqual({ referenceDate: "2026-10-15", thresholdDays: 2, created: 3, resolved: 0, open: 3 });
    // 2006 (Closing) and 2007 (Lost) are final; 2001 (1 day) and 2005 (today) are within the limit.
    expect(await openCodes()).toEqual(["OPP-2002", "OPP-2003", "OPP-2004"]);
  });

  it("is idempotent: a second run, sequential or concurrent, creates nothing", async () => {
    await followUp.run();
    expect(await followUp.run()).toMatchObject({ created: 0, resolved: 0, open: 3 });
    const concurrent = await Promise.all([followUp.run(), followUp.run(), followUp.run()]);
    expect(concurrent.map((run) => run.created)).toEqual([0, 0, 0]);
    expect(await openCodes()).toEqual(["OPP-2002", "OPP-2003", "OPP-2004"]);
  });

  it("closes the reminder when a contact is registered or the deal reaches a final stage", async () => {
    await followUp.run();
    await opportunities.registerContact(await idOf("OPP-2003"), { contactedOn: "2026-10-15" });
    const lost = await opportunities.get(await idOf("OPP-2004"));
    await opportunities.transition(lost.id, {
      toStage: "LOST",
      lostReason: "Cliente fechou com concorrente",
      expectedVersion: lost.version,
    });

    expect(await openCodes()).toEqual(["OPP-2002"]);
    const resolved = await db.query<{ code: string; resolution: string }>(
      `SELECT o.code, r.resolution FROM follow_up_reminders r JOIN opportunities o ON o.id = r.opportunity_id
       WHERE r.resolved_at IS NOT NULL ORDER BY o.code`,
    );
    expect(resolved.rows).toEqual([
      { code: "OPP-2003", resolution: "CONTACT_REGISTERED" },
      { code: "OPP-2004", resolution: "OPPORTUNITY_FINAL" },
    ]);
    expect(await followUp.run()).toMatchObject({ created: 0, resolved: 0, open: 1 });
  });

  it("keeps a reminder open when the registered contact is still too old", async () => {
    await followUp.run();
    await opportunities.registerContact(await idOf("OPP-2004"), { contactedOn: "2026-10-05" });
    expect(await openCodes()).toContain("OPP-2004");
  });

  it("raises a new reminder after the silence comes back on a later day", async () => {
    await followUp.run();
    await opportunities.registerContact(await idOf("OPP-2003"), { contactedOn: "2026-10-15" });

    clock = fixedClock("2026-10-17");
    const result = await followUp.run();
    // 2001 (14/10), 2003 (contact registered on 15/10) and 2005 (15/10) are now 2+ days old.
    expect(result).toMatchObject({ referenceDate: "2026-10-17", created: 3, open: 5 });
    expect(await openCodes()).toEqual(["OPP-2001", "OPP-2002", "OPP-2003", "OPP-2004", "OPP-2005"]);
  });
});
