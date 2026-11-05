const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** A random document id, 20 characters, like Firestore's own. */
export function randomId(length = 20): string {
  let id = ''
  while (id.length < length) {
    // Bytes from 248 up are skipped: 248 is the largest multiple of 62 below 256, so every character is equally likely.
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < 248 && id.length < length) id += ALPHABET[byte % 62]
    }
  }
  return id
}

export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A client-made idempotency key (docs/decisions/ledger.md), used as the ledger entry's id. */
export function isEntryKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value)
}
