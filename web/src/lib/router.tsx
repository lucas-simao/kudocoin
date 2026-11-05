// A few routes, so a small router: the path is the state, links push it, and Pages serves index.html for
// every path (public/_redirects).
import { type AnchorHTMLAttributes, type MouseEvent, useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'orgs' }
  | { name: 'new' }
  | { name: 'org'; slug: string }
  | { name: 'member'; slug: string; uid: string }
  | { name: 'settings'; slug: string }
  | { name: 'join'; token: string }
  | { name: 'account' }
  | { name: 'privacy' }
  /** Where a Slack person confirms linking their account; the token is in ?t= (docs/decisions/slack.md). */
  | { name: 'slackLink' }
  | { name: 'missing' }

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/

export function parse(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.some((part) => !SEGMENT.test(part))) return { name: 'missing' }
  const [first, second, third, fourth] = parts
  if (parts.length === 0) return { name: 'home' }
  if (first === 'orgs' && parts.length === 1) return { name: 'orgs' }
  if (first === 'new' && parts.length === 1) return { name: 'new' }
  if (first === 'account' && parts.length === 1) return { name: 'account' }
  if (first === 'privacy' && parts.length === 1) return { name: 'privacy' }
  if (first === 'slack' && second === 'link' && parts.length === 2) return { name: 'slackLink' }
  if (first === 'join' && parts.length === 2) return { name: 'join', token: second }
  if (first === 'o' && parts.length === 2) return { name: 'org', slug: second }
  if (first === 'o' && third === 'settings' && parts.length === 3) return { name: 'settings', slug: second }
  if (first === 'o' && third === 'm' && parts.length === 4) return { name: 'member', slug: second, uid: fourth }
  return { name: 'missing' }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/'
    case 'orgs':
      return '/orgs'
    case 'new':
      return '/new'
    case 'account':
      return '/account'
    case 'privacy':
      return '/privacy'
    case 'slackLink':
      return '/slack/link'
    case 'join':
      return `/join/${route.token}`
    case 'org':
      return `/o/${route.slug}`
    case 'settings':
      return `/o/${route.slug}/settings`
    case 'member':
      return `/o/${route.slug}/m/${route.uid}`
    case 'missing':
      return '/'
  }
}

const listeners = new Set<() => void>()

export function navigate(route: Route | string, replace = false): void {
  const path = typeof route === 'string' ? route : href(route)
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.scrollTo(0, 0)
  for (const listener of listeners) listener()
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.pathname))
  useEffect(() => {
    const update = () => setRoute(parse(window.location.pathname))
    listeners.add(update)
    window.addEventListener('popstate', update)
    return () => {
      listeners.delete(update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return route
}

export function Link({ to, onClick, ...rest }: { to: Route } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const target = href(to)
  return (
    <a
      href={target}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        navigate(target)
      }}
      {...rest}
    />
  )
}
