// Seasons by hand or every sprint (docs/decisions/sprints.md): calendar arithmetic, as pure functions.
import { ApiError } from '../errors'

export const SPRINT_WEEKS = [1, 2, 3, 4] as const

/** null for seasons closed by hand, or the sprint length in weeks. */
export function parseSprintWeeks(value: unknown): number | null {
  if (value === null || value === 0) return null
  if (typeof value === 'number' && (SPRINT_WEEKS as readonly number[]).includes(value)) return value
  throw new ApiError('invalid_request', { field: 'sprintWeeks' })
}

/** A calendar date (YYYY-MM-DD) moved by whole days. */
export function addDays(date: string, days: number): string {
  const at = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + days * 86_400_000
  return new Date(at).toISOString().slice(0, 10)
}

/** How far a time zone's clock is ahead of UTC at an instant, in milliseconds. */
function offset(at: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  const asUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The instant a calendar day begins in a time zone. */
export function startOfDay(date: string, timezone: string): Date {
  const midnightUtc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  const first = midnightUtc - offset(midnightUtc, timezone)
  // Once more from the first guess, for a day whose offset changes overnight.
  return new Date(midnightUtc - offset(first, timezone))
}

/** When the hourly job closes a season: as its last day ends. Never for seasons closed by hand. */
export function closesAt(endsOn: string, timezone: string, sprintWeeks: number | null | undefined): Date | null {
  return sprintWeeks ? startOfDay(addDays(endsOn, 1), timezone) : null
}

/**
 * The sprint after one that ended on `previousEndsOn`: it starts the next day and lasts `weeks` weeks. If the
 * job could not run for a while, whole sprints are skipped so the open one always contains today or later.
 */
export function nextSprint(previousEndsOn: string, weeks: number, today: string): { startsOn: string; endsOn: string } {
  let startsOn = addDays(previousEndsOn, 1)
  let endsOn = addDays(previousEndsOn, 7 * weeks)
  while (endsOn < today) {
    startsOn = addDays(endsOn, 1)
    endsOn = addDays(endsOn, 7 * weeks)
  }
  return { startsOn, endsOn }
}
