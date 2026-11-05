import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('turns a name into an address', () => {
    expect(slugify('Time de Plataforma')).toBe('time-de-plataforma')
    expect(slugify('Ação & Reação!')).toBe('acao-reacao')
    expect(slugify('42 Devs')).toBe('devs')
    expect(slugify('x'.repeat(60))).toHaveLength(40)
  })
})
