import { describe, expect, it } from 'vitest'
import { addDays } from './days'

describe('calendar days', () => {
  it('moves across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 14)).toBe('2027-01-14')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
