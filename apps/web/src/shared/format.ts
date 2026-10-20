import type { Attention, CalendarDate, Stage } from "@nobre/contracts";

export const STAGE_LABELS: Record<Stage, string> = {
  FIRST_CONTACT: "Primeiro Contato",
  QUOTE_PRESENTATION: "Apresentação de Orçamento",
  FOLLOW_UP: "Follow-up",
  FORECAST: "Forecast",
  CLOSING: "Fechamento",
  LOST: "Perdida",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("pt-BR");

export function formatCents(cents: number | null): string {
  return cents === null ? "Sem valor" : brl.format(cents / 100);
}

export function formatQuantity(quantity: number): string {
  return integer.format(quantity);
}

/** "2026-10-15" → "15/10/2026", without going through Date (no time zone shifts). */
export function formatDate(date: CalendarDate | null): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function formatShortDate(date: CalendarDate): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function attentionLabel(attention: Attention): string {
  if (attention.reason === "NO_CONTACT_RECORDED") return "Nenhum contato registrado";
  const days = attention.daysSinceLastContact;
  if (days === null) return "";
  if (days === 0) return "Contato hoje";
  return days === 1 ? "1 dia sem contato" : `${days} dias sem contato`;
}

/** Converts "1.234,56" / "1234.56" / "4500" typed by a seller into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "") return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}
