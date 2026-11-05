// The Worker trusts only a Firebase ID token: docs/decisions/sign-in.md.
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'
import type { Env } from '../env'
import { ApiError } from '../errors'

export interface Caller {
  uid: string
  name: string
  picture: string | null
  /** The GitHub login, when the person signed in with GitHub and the web app sent it. */
  provider: string | null
}

// Google's keys for Firebase ID tokens. jose caches them in memory and refreshes them on its own.
const keys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

export async function verifyIdToken(header: string | null, env: Env): Promise<Caller> {
  const token = header?.match(/^Bearer (.+)$/)?.[1]
  if (!token) throw new ApiError('unauthenticated')
  let claims: Record<string, unknown>
  try {
    if (env.AUTH_EMULATOR === 'true' && env.FIRESTORE_EMULATOR_HOST) {
      // The Auth emulator signs nothing. Only with both development settings, never in production.
      claims = decodeJwt(token)
      if (claims.aud !== env.FIREBASE_PROJECT_ID) throw new Error('audience')
    } else {
      const { payload } = await jwtVerify(token, keys, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
        algorithms: ['RS256'],
      })
      claims = payload
    }
  } catch {
    throw new ApiError('unauthenticated')
  }
  const uid = typeof claims.sub === 'string' ? claims.sub : ''
  if (!uid || uid.length > 128) throw new ApiError('unauthenticated')
  const firebase = (claims.firebase ?? {}) as { sign_in_provider?: string }
  return {
    uid,
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 80) : 'Member',
    picture: typeof claims.picture === 'string' ? claims.picture : null,
    provider: firebase.sign_in_provider ?? null,
  }
}
