// The three pieces of cryptography Slack needs (docs/decisions/slack.md): checking that a request came from
// Slack, short-lived tokens the Worker signs (the install's state and the link to connect a person), and
// sealing the workspace's token before it is stored. Two keys come from SLACK_KEY, one per job.

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function fromHex(hex: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null
  return Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16))
}

const derived = new Map<string, Promise<CryptoKey>>()

/** A key for one job, from SLACK_KEY with HKDF. */
function keyFor(secret: string, job: 'sign' | 'seal'): Promise<CryptoKey> {
  const id = `${job}:${secret}`
  let key = derived.get(id)
  if (!key) {
    key = crypto.subtle
      .importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey'])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('kudocoin-slack'), info: encoder.encode(job) },
          base,
          job === 'sign' ? { name: 'HMAC', hash: 'SHA-256', length: 256 } : { name: 'AES-GCM', length: 256 },
          false,
          job === 'sign' ? ['sign', 'verify'] : ['encrypt', 'decrypt'],
        ),
      )
    derived.set(id, key)
  }
  return key
}

export type Purpose = 'install' | 'link'

/** `<payload>.<signature>`, both base64url. The payload names its purpose and when it stops working. */
export async function signToken(secret: string, purpose: Purpose, data: Record<string, string>, lifetimeSeconds: number, now = Date.now()): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ ...data, p: purpose, e: Math.floor(now / 1000) + lifetimeSeconds })))
  const signature = await crypto.subtle.sign('HMAC', await keyFor(secret, 'sign'), encoder.encode(payload))
  return `${payload}.${base64url(new Uint8Array(signature))}`
}

/** The token's data, or null when it is forged, for another purpose, or expired. */
export async function readToken(secret: string, purpose: Purpose, token: unknown, now = Date.now()): Promise<Record<string, string> | null> {
  if (typeof token !== 'string' || token.length > 2000) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await keyFor(secret, 'sign'), fromBase64url(signature), encoder.encode(payload))
    if (!ok) return null
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Record<string, unknown>
    if (data.p !== purpose || typeof data.e !== 'number' || data.e * 1000 < now) return null
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) if (typeof value === 'string') out[key] = value
    return out
  } catch {
    return null
  }
}

/** AES-GCM with a fresh IV: `<iv>.<ciphertext>`, both base64url. */
export async function seal(secret: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(secret, 'seal'), encoder.encode(plain))
  return `${base64url(iv)}.${base64url(new Uint8Array(sealed))}`
}

export async function unseal(secret: string, sealed: string): Promise<string | null> {
  const [iv, data] = sealed.split('.')
  if (!iv || !data) return null
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64url(iv) }, await keyFor(secret, 'seal'), fromBase64url(data))
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/**
 * Slack's request signing: HMAC-SHA256 of `v0:<timestamp>:<body>` with the app's signing secret, sent as
 * `v0=<hex>`. A request older than five minutes is refused, so a recorded one cannot be replayed later.
 */
export async function fromSlack(signingSecret: string, headers: Headers, body: string, now = Date.now()): Promise<boolean> {
  const timestamp = headers.get('x-slack-request-timestamp') ?? ''
  const signature = headers.get('x-slack-signature') ?? ''
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const digest = fromHex(signature.startsWith('v0=') ? signature.slice(3) : '')
  if (!digest || digest.length !== 32) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, digest, encoder.encode(`v0:${timestamp}:${body}`))
}
