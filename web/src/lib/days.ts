/** A calendar date (YYYY-MM-DD) moved by whole days. The Worker has the same (worker/src/services/cadence.ts). */
export function addDays(date: string, days: number): string {
  const at = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + days * 86_400_000
  return new Date(at).toISOString().slice(0, 10)
}
