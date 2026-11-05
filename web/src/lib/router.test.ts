import { describe, expect, it } from 'vitest'
import { href, parse, type Route } from './router'

describe('router', () => {
  it('reads every route and writes it back', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'orgs' },
      { name: 'new' },
      { name: 'account' },
      { name: 'join', token: 'abc_DEF-123' },
      { name: 'org', slug: 'team-a' },
      { name: 'settings', slug: 'team-a' },
      { name: 'member', slug: 'team-a', uid: 'u123' },
    ]
    for (const route of routes) expect(parse(href(route))).toEqual(route)
  })

  it('treats a trailing slash as the same page', () => {
    expect(parse('/o/team-a/')).toEqual({ name: 'org', slug: 'team-a' })
  })

  it('sends anything else to the missing page', () => {
    expect(parse('/o')).toEqual({ name: 'missing' })
    expect(parse('/o/team-a/elsewhere')).toEqual({ name: 'missing' })
    expect(parse('/o/<script>')).toEqual({ name: 'missing' })
  })
})
