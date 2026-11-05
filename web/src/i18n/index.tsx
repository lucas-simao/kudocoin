// t() reads a text by its dotted key in the chosen language and fills in {{placeholders}}.
// The choice follows the browser on the first visit and is kept after (docs/decisions/languages.md).
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { en } from './locales/en'
import { ptBR } from './locales/pt-BR'
import type { Key, Lang, Messages } from './types'

export type { Key, Lang } from './types'

export const LOCALES: Record<Lang, Messages> = { 'pt-BR': ptBR, en }
export const LANGS: Lang[] = ['pt-BR', 'en']
const STORAGE = 'kudocoin.lang'

export function translate(messages: Messages, key: string, vars?: Record<string, string | number>): string {
  let value: unknown = messages
  for (const part of key.split('.')) value = (value as Record<string, unknown> | undefined)?.[part]
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function detectLang(): Lang {
  try {
    const query = new URLSearchParams(window.location.search).get('lang')
    if (query === 'pt') return 'pt-BR'
    if (query === 'en') return 'en'
    const saved = window.localStorage.getItem(STORAGE)
    if (saved === 'pt-BR' || saved === 'en') return saved
  } catch {
    // Storage can be off; the browser's language still answers.
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  /** Words for an API error code, with its details filled in. */
  error: (code: string | undefined, details?: Record<string, string | number>) => string
  number: (value: number) => string
  date: (isoDate: string) => string
}

const Context = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    document.documentElement.lang = next
    try {
      window.localStorage.setItem(STORAGE, next)
    } catch {
      // Not kept between visits then; the switch still works now.
    }
  }, [])
  const value = useMemo<I18n>(() => {
    const messages = LOCALES[lang]
    const numbers = new Intl.NumberFormat(lang)
    const dates = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    document.documentElement.lang = lang
    return {
      lang,
      setLang,
      t: (key, vars) => translate(messages, key, vars),
      error: (code, details) => {
        const known = code && code in messages.errors.codes
        return known ? translate(messages, `errors.codes.${code}`, details) : messages.errors.generic
      },
      number: (value) => numbers.format(value),
      date: (isoDate) => dates.format(new Date(`${isoDate}T12:00:00Z`)),
    }
  }, [lang, setLang])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n(): I18n {
  const value = useContext(Context)
  if (!value) throw new Error('useI18n outside I18nProvider')
  return value
}
