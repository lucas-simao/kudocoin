import type { ptBR } from './locales/pt-BR'

/** The shape of pt-BR with every text widened to string: what every other locale must fill. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }

export type Messages = Widen<typeof ptBR>

/** Every dotted path that ends at a string, like 'common.loading'. */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`
}[keyof T & string]

export type Key = Paths<Messages>

export type Lang = 'pt-BR' | 'en'
