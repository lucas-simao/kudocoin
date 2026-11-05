import { describe, expect, it } from 'vitest'
import { clamp } from './amount'

describe('the amount to give', () => {
  it('stays a whole number from 1 to the most allowed', () => {
    expect(clamp(3, 5)).toBe(3)
    expect(clamp(9, 5)).toBe(5)
    expect(clamp(0, 5)).toBe(1)
    expect(clamp(Number.NaN, 5)).toBe(1)
    expect(clamp(2.7, 5)).toBe(2)
    // With nothing left today the form is off, but the number still never drops below 1.
    expect(clamp(4, 0)).toBe(1)
  })
})
