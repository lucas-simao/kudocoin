import { describe, expect, it } from 'vitest'
import { seasonEnd } from '../src/services/orgs'
import { standings } from '../src/services/seasons'

describe('standings', () => {
  it('orders by balance and lets equal balances share a place', () => {
    const rows = standings({
      a: { name: 'Ana', picture: null, balance: 10 },
      b: { name: 'Bruno', picture: null, balance: 7 },
      c: { name: 'Carla', picture: null, balance: 7 },
      d: { name: 'Davi', picture: null, balance: 2 },
    })
    expect(rows.map((row) => [row.name, row.place])).toEqual([
      ['Ana', 1],
      ['Bruno', 2],
      ['Carla', 2],
      ['Davi', 4],
    ])
  })
})

describe('season end', () => {
  it('defaults to 31 December, or next year from December on', () => {
    expect(seasonEnd(undefined, '2026-11-05')).toBe('2026-12-31')
    expect(seasonEnd(undefined, '2026-12-02')).toBe('2027-12-31')
  })

  it('takes a real date from today on', () => {
    expect(seasonEnd('2027-03-31', '2026-11-05')).toBe('2027-03-31')
    expect(() => seasonEnd('2026-10-01', '2026-11-05')).toThrow()
    expect(() => seasonEnd('2027-02-30', '2026-11-05')).toThrow()
  })
})
