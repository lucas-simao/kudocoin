import { describe, expect, it } from 'vitest'
import { ApiError } from '../src/errors'
import {
  checkGive,
  checkSlug,
  countOn,
  dateIn,
  DEFAULT_SETTINGS,
  type GiveCheck,
  isDate,
  parseSettings,
  seasonEnded,
} from '../src/services/rules'

const base: GiveCheck = {
  kind: 'give',
  giverUid: 'ana',
  receiverUid: 'bruno',
  receiverIsMember: true,
  amount: 2,
  reason: 'Reviewed my PR',
  settings: DEFAULT_SETTINGS,
  today: '2026-11-05',
  giverGiven: undefined,
  receiverReceived: undefined,
  seasonOpen: true,
}

function refusal(check: Partial<GiveCheck>): string | undefined {
  try {
    checkGive({ ...base, ...check })
    return undefined
  } catch (error) {
    return error instanceof ApiError ? error.code : String(error)
  }
}

describe('checkGive', () => {
  it('lets a normal give through', () => {
    expect(refusal({})).toBe(undefined)
  })

  it('refuses a give to oneself', () => {
    expect(refusal({ receiverUid: 'ana' })).toBe('self_give')
  })

  it('refuses a receiver from outside the organization', () => {
    expect(refusal({ receiverIsMember: false })).toBe('not_a_member')
  })

  it('refuses amounts that are not whole, below one or above the most per give', () => {
    expect(refusal({ amount: 0 })).toBe('amount_invalid')
    expect(refusal({ amount: 1.5 })).toBe('amount_invalid')
    expect(refusal({ amount: 6 })).toBe('amount_invalid')
    expect(refusal({ amount: 5 })).toBe(undefined)
  })

  it('needs a reason when the organization asks for one, and keeps it short', () => {
    expect(refusal({ reason: '   ' })).toBe('reason_required')
    expect(refusal({ reason: '', settings: { ...DEFAULT_SETTINGS, reasonRequired: false } })).toBe(undefined)
    expect(refusal({ reason: 'x'.repeat(281) })).toBe('reason_too_long')
  })

  it('counts only what was given today against the allowance', () => {
    expect(refusal({ giverGiven: { date: '2026-11-05', amount: 4 } })).toBe('allowance_exceeded')
    expect(refusal({ giverGiven: { date: '2026-11-05', amount: 3 } })).toBe(undefined)
    expect(refusal({ giverGiven: { date: '2026-11-04', amount: 5 } })).toBe(undefined)
  })

  it('caps what one person receives in a day', () => {
    expect(refusal({ receiverReceived: { date: '2026-11-05', amount: 19 } })).toBe('receiver_limit_exceeded')
    expect(refusal({ receiverReceived: { date: '2026-11-04', amount: 20 } })).toBe(undefined)
  })

  it('refuses gives in a closed season', () => {
    expect(refusal({ seasonOpen: false })).toBe('season_closed')
  })

  it('lets an admin award skip the daily limits but not the reason', () => {
    const full = { giverGiven: { date: '2026-11-05', amount: 5 }, receiverReceived: { date: '2026-11-05', amount: 20 } }
    expect(refusal({ ...full, kind: 'award', amount: 50 })).toBe(undefined)
    expect(refusal({ kind: 'award', reason: '', settings: { ...DEFAULT_SETTINGS, reasonRequired: false } })).toBe('reason_required')
    expect(refusal({ kind: 'award', receiverUid: 'ana' })).toBe('self_give')
  })
})

describe('days', () => {
  it('reads a count only on its own date', () => {
    expect(countOn({ date: '2026-11-05', amount: 3 }, '2026-11-05')).toBe(3)
    expect(countOn({ date: '2026-11-04', amount: 3 }, '2026-11-05')).toBe(0)
    expect(countOn(undefined, '2026-11-05')).toBe(0)
  })

  it('takes the date in the organization time zone', () => {
    const lateNightInBrazil = new Date('2026-11-06T02:30:00Z')
    expect(dateIn('America/Sao_Paulo', lateNightInBrazil)).toBe('2026-11-05')
    expect(dateIn('UTC', lateNightInBrazil)).toBe('2026-11-06')
    expect(dateIn('Asia/Tokyo', lateNightInBrazil)).toBe('2026-11-06')
  })

  it('ends a season after its last day', () => {
    expect(seasonEnded('2026-12-31', '2026-12-31')).toBe(false)
    expect(seasonEnded('2026-12-31', '2027-01-01')).toBe(true)
  })

  it('reads only real dates', () => {
    expect(isDate('2026-12-31')).toBe(true)
    expect(isDate('2026-02-30')).toBe(false)
    expect(isDate('31/12/2026')).toBe(false)
  })
})

describe('settings', () => {
  it('fills what is not sent from the defaults', () => {
    expect(parseSettings({ dailyAllowance: 10 })).toEqual({ ...DEFAULT_SETTINGS, dailyAllowance: 10 })
  })

  it('refuses numbers out of range and a most per give above the allowance', () => {
    expect(() => parseSettings({ dailyAllowance: 0 })).toThrow(ApiError)
    expect(() => parseSettings({ dailyAllowance: 3, maxPerGive: 5 })).toThrow(ApiError)
    expect(() => parseSettings({ timezone: 'Mars/Olympus' })).toThrow(ApiError)
    expect(() => parseSettings({ coinName: '' })).toThrow(ApiError)
  })
})

describe('slugs', () => {
  it('accepts lowercase words with hyphens', () => {
    expect(() => checkSlug('team-rocket')).not.toThrow()
    expect(() => checkSlug('dev42')).not.toThrow()
  })

  it('refuses short, odd or reserved slugs', () => {
    for (const slug of ['ab', '1team', 'Team', 'team-', 'a--b', 'join', 'admin', 'x'.repeat(41)]) {
      expect(() => checkSlug(slug), slug).toThrow(ApiError)
    }
  })
})
