/**
 * Central confidence formatter (Honest-Core P0-12).
 * Graph stores a ratio 0..1; some legacy callers already pass percent > 1.
 * Always render as de-DE percent with one fraction digit, or null when unknown.
 */

export function formatConfidence(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const ratio = value > 1 ? value / 100 : value;
  const clamped = Math.min(1, Math.max(0, ratio));
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(clamped);
}
