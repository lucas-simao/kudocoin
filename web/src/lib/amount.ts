/** A whole number from 1 to max; anything else (empty, zero, too many) becomes the nearest of those. */
export function clamp(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.floor(value), Math.max(1, max))
}
