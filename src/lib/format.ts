import type { Payment, SessionItem } from "./types";

// ── Brand ────────────────────────────────────────────────────────────────
export const VENUE_NAME = "Caffè Lumo";
export const VENUE_TAGLINE = "Modern Italian · London";

// ── Money ──────────────────────────────────────────────────────────────────
const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as GBP, e.g. 16.5 → "£16.50". */
export function money(amount: number): string {
  return gbp.format(round2(amount));
}

/** Round to 2 dp without binary-float dust. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Service charge ──────────────────────────────────────────────────────────
export const SERVICE_OPTIONS = [0, 10, 12.5, 15] as const;

export function serviceAmount(subtotal: number, pct: number): number {
  return round2((subtotal * pct) / 100);
}

// ── Bill maths ──────────────────────────────────────────────────────────────

/** Full value of a single ordered line: price × qty. */
export function lineTotal(item: SessionItem): number {
  return round2(item.price * item.qty);
}

/** Whole-table total across all ordered items. */
export function billTotal(items: SessionItem[]): number {
  return round2(items.reduce((sum, i) => sum + lineTotal(i), 0));
}

/** Value still claimable on a line (in money), given who's claimed what. */
export function remainingValue(item: SessionItem): number {
  return round2(item.price * Math.max(0, item.qty - item.claimed_qty));
}

/** Is a line fully claimed (within rounding)? */
export function isFullyClaimed(item: SessionItem): boolean {
  return item.claimed_qty >= item.qty - 1e-6;
}

/** Total value already paid for via payments rows. */
export function paidValue(payments: Payment[]): number {
  return round2(payments.reduce((sum, p) => sum + p.subtotal, 0));
}

/**
 * A session is "settled" only when the WHOLE bill has been paid — every item
 * on the table is covered, not just the claimed ones. This keeps the green
 * "Paid" status accurate: it appears the moment the last pound is settled.
 */
export function isSettled(items: SessionItem[], payments: Payment[]): boolean {
  if (payments.length === 0) return false;
  const total = billTotal(items);
  return total > 0 && paidValue(payments) >= total - 1e-6;
}
