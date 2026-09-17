/** FCRA investigation window helpers (30 days default, 45 if extended). */

export const INVESTIGATION_DAYS = 30;
export const INVESTIGATION_EXTENDED_DAYS = 45;

export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function investigationDueFromDelivery(
  deliveredAt: Date,
  extended = false,
): Date {
  return addDays(
    deliveredAt,
    extended ? INVESTIGATION_EXTENDED_DAYS : INVESTIGATION_DAYS,
  );
}

export function daysRemaining(dueAt: Date, now = new Date()): number {
  const ms = dueAt.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function investigationStatus(
  dueAt: Date | null | undefined,
  now = new Date(),
): "not_started" | "on_track" | "due_soon" | "overdue" {
  if (!dueAt) return "not_started";
  const remaining = daysRemaining(dueAt, now);
  if (remaining < 0) return "overdue";
  if (remaining <= 5) return "due_soon";
  return "on_track";
}

/** Simulated USPS-style tracking id for Phase 2 stub (replace with Lob). */
export function simulateTrackingNumber(seed: string): string {
  const digits = Array.from(seed)
    .map((c) => c.charCodeAt(0))
    .join("")
    .slice(0, 18)
    .padEnd(18, "0");
  return `9400${digits.slice(0, 16)}`;
}
