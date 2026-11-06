import { describe, expect, it } from 'vitest'
import { addDays, closesAt, nextSprint, parseSprintWeeks, startOfDay } from '../src/services/cadence'

describe('calendar days', () => {
  it('moves across months, years and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds when a day begins in a time zone, daylight saving included', () => {
    expect(startOfDay('2026-11-20', 'America/Sao_Paulo').toISOString()).toBe('2026-11-20T03:00:00.000Z')
    expect(startOfDay('2026-11-20', 'UTC').toISOString()).toBe('2026-11-20T00:00:00.000Z')
    expect(startOfDay('2026-07-01', 'Europe/Lisbon').toISOString()).toBe('2026-06-30T23:00:00.000Z')
    expect(startOfDay('2026-01-15', 'Europe/Lisbon').toISOString()).toBe('2026-01-15T00:00:00.000Z')
    // New York moves its clocks on 8 March 2026; midnight that day is still standard time.
    expect(startOfDay('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(startOfDay('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(startOfDay('2026-11-20', 'Asia/Kolkata').toISOString()).toBe('2026-11-19T18:30:00.000Z')
  })
})

describe('sprints', () => {
  it('close as their last day ends, and only in sprint mode', () => {
    expect(closesAt('2026-11-16', 'America/Sao_Paulo', 2)?.toISOString()).toBe('2026-11-17T03:00:00.000Z')
    expect(closesAt('2026-11-16', 'America/Sao_Paulo', null)).toBe(null)
  })

  it('follow each other without gaps, skipping any that passed while the job could not run', () => {
    expect(nextSprint('2026-11-16', 2, '2026-11-17')).toEqual({ startsOn: '2026-11-17', endsOn: '2026-11-30' })
    expect(nextSprint('2026-11-16', 1, '2026-11-16')).toEqual({ startsOn: '2026-11-17', endsOn: '2026-11-23' })
    expect(nextSprint('2026-11-16', 1, '2026-12-02')).toEqual({ startsOn: '2026-12-01', endsOn: '2026-12-07' })
  })

  it('last 1 to 4 weeks, or nothing for seasons closed by hand', () => {
    expect(parseSprintWeeks(2)).toBe(2)
    expect(parseSprintWeeks(null)).toBe(null)
    expect(parseSprintWeeks(0)).toBe(null)
    expect(() => parseSprintWeeks(5)).toThrow()
    expect(() => parseSprintWeeks('2')).toThrow()
  })
})
