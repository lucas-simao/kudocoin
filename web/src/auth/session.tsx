// Who is signed in. After each sign-in the profile is synced to the Worker, which keeps the name, picture,
// GitHub login and language (docs/decisions/sign-in.md).
import {
  getAdditionalUserInfo,
  getRedirectResult,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { useI18n } from '@/i18n'
import { auth } from './firebase'

type Provider = 'github' | 'google'

interface Session {
  user: User | null
  /** False until Firebase has said whether someone is signed in. */
  ready: boolean
  signIn: (provider: Provider) => Promise<void>
  signOut: () => Promise<void>
}

const Context = createContext<Session | null>(null)

// Phones block popups more often; a redirect works everywhere, at the cost of leaving the page.
const prefersRedirect = () => window.matchMedia('(max-width: 640px)').matches

export function SessionProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [ready, setReady] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next)
        setReady(true)
      }),
    [],
  )

  // Back from a redirect sign-in (phones): keep the GitHub login, as the popup does.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        const login = result ? getAdditionalUserInfo(result)?.username : undefined
        if (result?.providerId === 'github.com' && login) return api.syncProfile(lang, login)
      })
      .catch(() => undefined)
    // Once per page load; the language at that moment is the right one to keep.
  }, [])

  // The language follows the person to another device.
  useEffect(() => {
    if (user) api.syncProfile(lang).catch(() => undefined)
  }, [user, lang])

  const value = useMemo<Session>(
    () => ({
      user,
      ready,
      async signIn(provider) {
        const chosen = provider === 'github' ? new GithubAuthProvider() : new GoogleAuthProvider()
        if (prefersRedirect()) return signInWithRedirect(auth, chosen)
        const result = await signInWithPopup(auth, chosen)
        const login = getAdditionalUserInfo(result)?.username
        if (provider === 'github' && login) await api.syncProfile(lang, login).catch(() => undefined)
      },
      signOut: () => firebaseSignOut(auth),
    }),
    [user, ready, lang],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useSession(): Session {
  const value = useContext(Context)
  if (!value) throw new Error('useSession outside SessionProvider')
  return value
}

/** The words for a Firebase sign-in failure. */
export function signInError(error: unknown): 'auth.popupClosed' | 'auth.otherProvider' | 'auth.failed' {
  const code = (error as { code?: string } | null)?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'auth.popupClosed'
  if (code === 'auth/account-exists-with-different-credential') return 'auth.otherProvider'
  return 'auth.failed'
}
