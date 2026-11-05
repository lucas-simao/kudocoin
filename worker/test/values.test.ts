import { describe, expect, it } from 'vitest'
import { decode, decodeFields, encode, encodeFields, fieldSegment } from '../src/firestore/values'

describe('firestore values', () => {
  it('encodes whole numbers as integers and others as doubles', () => {
    expect(encode(5)).toEqual({ integerValue: '5' })
    expect(encode(1.5)).toEqual({ doubleValue: 1.5 })
  })

  it('round-trips nested maps, arrays, dates and nulls', () => {
    const at = new Date('2026-11-05T12:00:00.000Z')
    const value = { name: 'Ana', balance: 12, at, tags: ['a', 'b'], day: { date: '2026-11-05', amount: 3 }, gone: null }
    expect(decodeFields(encodeFields(value))).toEqual(value)
    expect(decode(encode([1, 'two', true]))).toEqual([1, 'two', true])
  })

  it('leaves undefined fields out', () => {
    expect(encodeFields({ a: 1, b: undefined })).toEqual({ a: { integerValue: '1' } })
  })

  it('quotes field path segments that are not simple names', () => {
    expect(fieldSegment('balance')).toBe('balance')
    expect(fieldSegment('3fK9xYz')).toBe('`3fK9xYz`')
    expect(fieldSegment('a-b')).toBe('`a-b`')
  })
})
