import type { CalendarDate, Stage } from "@nobre/contracts";
import { addDays, daysBetween } from "@nobre/domain";

export interface SeedOpportunity {
  code: string;
  companyName: string;
  sellerName: string | null;
  estimatedValueCents: number | null;
  items: { name: string; quantity: number }[];
  lastContactOn: CalendarDate | null;
  proposalValidUntil: CalendarDate | null;
  eventDate: CalendarDate | null;
  stage: Stage;
  lostReason: string | null;
}

export const CASE_REFERENCE_DATE: CalendarDate = "2026-10-15";

export const CASE_SELLERS = ["Ana", "Bruno", "Carla"] as const;

/** The seven opportunities exactly as printed in the case PDF (blank cells are null). */
export const CASE_OPPORTUNITIES_AS_GIVEN: readonly SeedOpportunity[] = [
  {
    code: "OPP-2001",
    companyName: "Tech Alpha Ltda",
    sellerName: "Ana",
    estimatedValueCents: 450_000,
    items: [{ name: "Caneca personalizada", quantity: 300 }],
    lastContactOn: "2026-10-14",
    proposalValidUntil: null,
    eventDate: "2026-11-30",
    stage: "FIRST_CONTACT",
    lostReason: null,
  },
  {
    code: "OPP-2002",
    companyName: "Construtora Horizonte",
    sellerName: "Bruno",
    estimatedValueCents: 980_000,
    items: [{ name: "Kit escritório", quantity: 120 }],
    lastContactOn: "2026-10-06",
    proposalValidUntil: "2026-10-13",
    eventDate: "2026-10-25",
    stage: "QUOTE_PRESENTATION",
    lostReason: null,
  },
  {
    code: "OPP-2003",
    companyName: "Clínica Vida",
    sellerName: "Ana",
    estimatedValueCents: 720_000,
    items: [{ name: "Squeeze personalizado", quantity: 500 }],
    lastContactOn: "2026-10-13",
    proposalValidUntil: "2026-10-20",
    eventDate: "2026-10-18",
    stage: "FOLLOW_UP",
    lostReason: null,
  },
  {
    code: "OPP-2004",
    companyName: "Agência Pulso",
    sellerName: "Carla",
    estimatedValueCents: 390_000,
    items: [{ name: "Camiseta estampada", quantity: 80 }],
    lastContactOn: "2026-10-02",
    proposalValidUntil: "2026-10-10",
    eventDate: "2026-11-05",
    stage: "FOLLOW_UP",
    lostReason: null,
  },
  {
    code: "OPP-2005",
    companyName: "Banco Norte",
    sellerName: "Bruno",
    estimatedValueCents: 3_800_000,
    items: [{ name: "Agenda executiva", quantity: 1000 }],
    lastContactOn: "2026-10-15",
    proposalValidUntil: "2026-10-22",
    eventDate: "2026-12-12",
    stage: "FORECAST",
    lostReason: null,
  },
  {
    code: "OPP-2006",
    companyName: "Escola Saber",
    sellerName: "Carla",
    estimatedValueCents: 1_150_000,
    items: [{ name: "Mochila infantil", quantity: 250 }],
    lastContactOn: "2026-10-09",
    proposalValidUntil: "2026-10-16",
    eventDate: "2026-10-17",
    stage: "CLOSING",
    lostReason: null,
  },
  {
    code: "OPP-2007",
    companyName: "Padaria do Bairro",
    sellerName: "Ana",
    estimatedValueCents: 35_000,
    items: [{ name: "Caneta promocional", quantity: 50 }],
    lastContactOn: "2026-10-01",
    proposalValidUntil: "2026-10-08",
    eventDate: "2026-10-20",
    stage: "LOST",
    lostReason: null,
  },
];

export interface SeedCorrection {
  code: string;
  field: keyof SeedOpportunity;
  from: unknown;
  to: unknown;
  why: string;
}

/**
 * Data that breaks a business rule is corrected explicitly, never silently.
 * Each entry is listed in the README; the original value is kept in `from`.
 */
export const CASE_CORRECTIONS: readonly SeedCorrection[] = [
  {
    code: "OPP-2007",
    field: "lostReason",
    from: null,
    to: "Motivo não registrado na carga original",
    why: "LOST requires a reason; the source row has none, so the gap is made explicit instead of weakening the rule.",
  },
];

/**
 * Moves the rows from the PDF reference date onto `today`, keeping every gap
 * between dates intact. The table above stays byte-identical to the case, while
 * the seeded database always reads as if the case were happening now.
 */
export function shiftOnto(rows: readonly SeedOpportunity[], today: CalendarDate): SeedOpportunity[] {
  const offset = daysBetween(CASE_REFERENCE_DATE, today);
  const shift = (date: CalendarDate | null) => (date === null ? null : addDays(date, offset));
  return rows.map((row) => ({
    ...row,
    lastContactOn: shift(row.lastContactOn),
    proposalValidUntil: shift(row.proposalValidUntil),
    eventDate: shift(row.eventDate),
  }));
}

export function applyCorrections(
  rows: readonly SeedOpportunity[],
  corrections: readonly SeedCorrection[],
): SeedOpportunity[] {
  return rows.map((row) =>
    corrections
      .filter((correction) => correction.code === row.code)
      .reduce<SeedOpportunity>((acc, correction) => ({ ...acc, [correction.field]: correction.to }), row),
  );
}
