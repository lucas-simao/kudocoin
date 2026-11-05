import { describe, expect, it } from 'vitest'
import { en } from './locales/en'
import { ptBR } from './locales/pt-BR'
import { translate } from './index'

function leaves(node: unknown, path = ''): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [[path, node]]
  return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key))
}

describe('locales', () => {
  it('have the same keys', () => {
    const pt = leaves(ptBR).map(([path]) => path).sort()
    const english = leaves(en).map(([path]) => path).sort()
    expect(english).toEqual(pt)
  })

  it('have a non-empty text at every key', () => {
    for (const [path, value] of [...leaves(ptBR), ...leaves(en)]) {
      expect(typeof value === 'string' && value.trim().length > 0, path).toBe(true)
    }
  })

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: unknown) => [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    const english = new Map(leaves(en))
    for (const [path, value] of leaves(ptBR)) {
      expect(placeholders(english.get(path)), path).toEqual(placeholders(value))
    }
  })
})

describe('translate', () => {
  it('reads a key and fills placeholders', () => {
    expect(translate(ptBR, 'give.left', { n: 3 })).toBe('Você ainda pode dar 3 hoje')
    expect(translate(en, 'give.left', { n: 3 })).toBe('You can still give 3 today')
  })

  it('answers the key itself when it is missing', () => {
    expect(translate(en, 'nope.never')).toBe('nope.never')
  })
})
