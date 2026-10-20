import type { CalendarDate, Stage } from "@nobre/contracts";
import { addDays } from "@nobre/domain";
import type { SeedOpportunity } from "./case-data.js";

export const SYNTHETIC_SELLERS = ["Diego", "Elisa"] as const;

const COMPANY_PREFIXES = [
  "Grupo", "Rede", "Instituto", "Hospital", "Colégio", "Construtora", "Agência", "Clínica",
  "Farmácia", "Academia", "Transportadora", "Cooperativa", "Laboratório", "Hotel", "Editora",
];
const COMPANY_NAMES = [
  "Aurora", "Atlântico", "Serra Azul", "Vale Verde", "Horizonte Sul", "Ipê", "Jacarandá",
  "Litoral", "Planalto", "Monte Claro", "Rio Doce", "Boa Vista", "Primavera", "Cerrado",
];
const GIFTS = [
  "Caneca personalizada", "Garrafa térmica", "Ecobag", "Caderno A5", "Power bank",
  "Kit churrasco", "Camiseta estampada", "Boné bordado", "Mochila executiva", "Agenda executiva",
  "Squeeze personalizado", "Chaveiro metálico", "Guarda-chuva", "Mouse pad", "Caneta metálica",
];
const LOST_REASONS = [
  "Preço acima do orçamento do cliente",
  "Cliente fechou com concorrente",
  "Prazo de produção incompatível com o evento",
  "Evento cancelado pelo cliente",
];

/** Weighted so the board looks like a real funnel: wide at the top, narrow at the end. */
const STAGE_WEIGHTS: readonly [Stage, number][] = [
  ["FIRST_CONTACT", 24],
  ["QUOTE_PRESENTATION", 20],
  ["FOLLOW_UP", 22],
  ["FORECAST", 14],
  ["CLOSING", 10],
  ["LOST", 10],
];

/** mulberry32: tiny deterministic PRNG, so every run produces the same data. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    chance: (probability: number) => next() < probability,
  };
}

function pickStage(random: ReturnType<typeof createRandom>): Stage {
  const total = STAGE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random.next() * total;
  for (const [stage, weight] of STAGE_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return stage;
  }
  return "FIRST_CONTACT";
}

/**
 * Builds extra, clearly-flagged synthetic opportunities (OPP-3001 onwards) around a
 * reference date. They respect every business rule, except that some FIRST_CONTACT
 * leads have no value or items yet, which is exactly the case the rules guard.
 */
export function buildSyntheticOpportunities(
  count: number,
  referenceDate: CalendarDate,
  seed = 2026,
): SeedOpportunity[] {
  const random = createRandom(seed);
  const sellers = ["Ana", "Bruno", "Carla", ...SYNTHETIC_SELLERS];
  const usedNames = new Set<string>();
  const result: SeedOpportunity[] = [];

  for (let index = 0; index < count; index++) {
    const stage = pickStage(random);
    let companyName = `${random.pick(COMPANY_PREFIXES)} ${random.pick(COMPANY_NAMES)}`;
    while (usedNames.has(companyName)) companyName = `${companyName} ${random.int(2, 9)}`;
    usedNames.add(companyName);

    const isEarlyLead = stage === "FIRST_CONTACT";
    const hasQuoteData = !isEarlyLead || random.chance(0.5);
    const items = hasQuoteData
      ? Array.from({ length: random.int(1, 3) }, () => ({
          name: random.pick(GIFTS),
          quantity: random.int(2, 60) * 10,
        }))
      : [];
    const lastContactOn =
      isEarlyLead && random.chance(0.25) ? null : addDays(referenceDate, -random.int(0, 12));

    result.push({
      code: `OPP-${3001 + index}`,
      companyName,
      sellerName: random.chance(0.06) ? null : random.pick(sellers),
      estimatedValueCents: hasQuoteData ? random.int(8, 600) * 10_000 : null,
      items,
      lastContactOn,
      proposalValidUntil:
        hasQuoteData && !isEarlyLead && lastContactOn ? addDays(lastContactOn, random.int(5, 15)) : null,
      eventDate: random.chance(0.85) ? addDays(referenceDate, random.int(3, 90)) : null,
      stage,
      lostReason: stage === "LOST" ? random.pick(LOST_REASONS) : null,
    });
  }
  return result;
}
