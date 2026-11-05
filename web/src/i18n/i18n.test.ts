import { describe, expect, it } from 'vitest'
import { en } from './locales/en'
import { es } from './locales/es'
import { ptBR } from './locales/pt-BR'
import { translate } from './index'

function leaves(node: unknown, path = ''): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [[path, node]]
  return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key))
}

describe('locales', () => {
  const others = { en, es }

  it('have the same keys', () => {
    const pt = leaves(ptBR).map(([path]) => path).sort()
    for (const locale of Object.values(others)) expect(leaves(locale).map(([path]) => path).sort()).toEqual(pt)
  })

  it('have a non-empty text at every key', () => {
    for (const [path, value] of [ptBR, en, es].flatMap((locale) => leaves(locale))) {
      expect(typeof value === 'string' && value.trim().length > 0, path).toBe(true)
    }
  })

  it('use the same placeholders in every language', () => {
    const placeholders = (text: unknown) => [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    for (const locale of Object.values(others)) {
      const texts = new Map(leaves(locale))
      for (const [path, value] of leaves(ptBR)) expect(placeholders(texts.get(path)), path).toEqual(placeholders(value))
    }
  })
})

describe('translate', () => {
  it('reads a key and fills placeholders', () => {
    expect(translate(ptBR, 'give.left', { n: 3 })).toBe('Você ainda pode dar 3 hoje')
    expect(translate(en, 'give.left', { n: 3 })).toBe('You can still give 3 today')
    expect(translate(es, 'give.left', { n: 3 })).toBe('Todavía puedes dar 3 hoy')
  })

  it('answers the key itself when it is missing', () => {
    expect(translate(en, 'nope.never')).toBe('nope.never')
  })
})
