// Firestore through its REST API, as the service account, which Firestore rules do not restrict.
// The access token is kept in memory between requests (docs/decisions/zero-cost-hosting.md).
import { importPKCS8, SignJWT } from 'jose'
import type { Env } from '../env'
import { ApiError } from '../errors'
import { decodeFields, encodeFields, type FsValue, type Plain } from './values'

export type Doc = { [key: string]: Plain }

export interface Write {
  /** Path below `documents/`, like `orgs/abc/members/uid`. */
  path: string
  /** Fields to write. With `mask`, only those field paths change; without it, the document is replaced. */
  fields?: Doc
  mask?: string[]
  /** `false`: the document must not exist yet. `true`: it must exist. */
  exists?: boolean
  delete?: boolean
}

let cachedToken: { value: string; expires: number; email: string } | undefined

async function accessToken(env: Env): Promise<string> {
  if (env.FIRESTORE_EMULATOR_HOST) return 'owner'
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new ApiError('internal')
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.email === env.FIREBASE_CLIENT_EMAIL && cachedToken.expires - 60 > now) {
    return cachedToken.value
  }
  const key = await importPKCS8(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setSubject(env.FIREBASE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new ApiError('internal')
  const body = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: body.access_token, expires: now + body.expires_in, email: env.FIREBASE_CLIENT_EMAIL }
  return body.access_token
}

export class Firestore {
  private readonly root: string
  private readonly base: string

  constructor(private readonly env: Env) {
    const host = env.FIRESTORE_EMULATOR_HOST ? `http://${env.FIRESTORE_EMULATOR_HOST}` : 'https://firestore.googleapis.com'
    this.root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
    this.base = `${host}/v1/${this.root}`
  }

  name(path: string): string {
    return `${this.root}/${path}`
  }

  private async call<T>(method: string, url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${await accessToken(this.env)}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 404) throw new NotFound()
    // A failed precondition or a transaction that lost a race.
    if (response.status === 409 || (response.status === 400 && (await peekStatus(response)) === 'FAILED_PRECONDITION')) {
      throw new Conflict()
    }
    if (!response.ok) throw new ApiError('internal')
    return (await response.json()) as T
  }

  /** Reads documents by path, in one request. A missing document comes back as undefined. */
  async getAll(paths: string[], transaction?: string): Promise<(Doc | undefined)[]> {
    if (paths.length === 0) return []
    const results = await this.call<{ found?: { name: string; fields?: Record<string, FsValue> }; missing?: string }[]>(
      'POST',
      `${this.base}:batchGet`,
      { documents: paths.map((path) => this.name(path)), ...(transaction ? { transaction } : {}) },
    )
    const byName = new Map<string, Doc | undefined>()
    for (const result of results) {
      if (result.found) byName.set(result.found.name, decodeFields(result.found.fields ?? {}))
      else if (result.missing) byName.set(result.missing, undefined)
    }
    return paths.map((path) => byName.get(this.name(path)))
  }

  async get(path: string): Promise<Doc | undefined> {
    return (await this.getAll([path]))[0]
  }

  /** Every document of a collection whose field equals a value. Small collections only. */
  async where(parentPath: string, collection: string, field: string, value: Plain, limit = 200): Promise<{ id: string; doc: Doc }[]> {
    const parent = parentPath ? `${this.base}/${parentPath}` : this.base
    const rows = await this.call<{ document?: { name: string; fields?: Record<string, FsValue> } }[]>(
      'POST',
      `${parent}:runQuery`,
      {
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encodeFields({ v: value }).v } },
          limit,
        },
      },
    )
    return rows
      .filter((row) => row.document)
      .map((row) => ({ id: row.document!.name.split('/').pop()!, doc: decodeFields(row.document!.fields ?? {}) }))
  }

  /** Every document of a collection, a page of up to 300 at a time. */
  async list(collectionPath: string): Promise<{ id: string; doc: Doc }[]> {
    const all: { id: string; doc: Doc }[] = []
    let pageToken = ''
    do {
      const query = new URLSearchParams({ pageSize: '300', ...(pageToken ? { pageToken } : {}) })
      const page = await this.call<{ documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string }>(
        'GET',
        `${this.base}/${collectionPath}?${query}`,
      )
      for (const document of page.documents ?? []) {
        all.push({ id: document.name.split('/').pop()!, doc: decodeFields(document.fields ?? {}) })
      }
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)
    return all
  }

  async begin(): Promise<string> {
    const body = await this.call<{ transaction: string }>('POST', `${this.base}:beginTransaction`, {})
    return body.transaction
  }

  async commit(writes: Write[], transaction?: string): Promise<void> {
    await this.call('POST', `${this.base}:commit`, {
      writes: writes.map((write) => this.toWrite(write)),
      ...(transaction ? { transaction } : {}),
    })
  }

  /**
   * Runs `work` in a Firestore transaction: reads inside it see one consistent state, and the commit fails
   * if any of them changed. One retry, then "conflict" (docs/decisions/ledger.md).
   */
  async transaction<T>(work: (tx: Transaction) => Promise<{ writes: Write[]; result: T }>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const id = await this.begin()
      let outcome: { writes: Write[]; result: T }
      try {
        outcome = await work(new Transaction(this, id))
      } catch (error) {
        // Firestore holds locks on what a transaction read until it ends: a refused give must end it too,
        // or the next one on the same documents waits and fails.
        await this.rollback(id)
        throw error
      }
      if (outcome.writes.length === 0) {
        await this.rollback(id)
        return outcome.result
      }
      try {
        await this.commit(outcome.writes, id)
        return outcome.result
      } catch (error) {
        if (error instanceof Conflict && attempt === 0) continue
        if (error instanceof Conflict) throw new ApiError('conflict')
        throw error
      }
    }
  }

  async rollback(transaction: string): Promise<void> {
    await this.call('POST', `${this.base}:rollback`, { transaction }).catch(() => undefined)
  }

  private toWrite(write: Write): Record<string, unknown> {
    const name = this.name(write.path)
    const precondition = write.exists === undefined ? undefined : { exists: write.exists }
    if (write.delete) return { delete: name, ...(precondition ? { currentDocument: precondition } : {}) }
    return {
      update: { name, fields: encodeFields(write.fields ?? {}) },
      ...(write.mask ? { updateMask: { fieldPaths: write.mask } } : {}),
      ...(precondition ? { currentDocument: precondition } : {}),
    }
  }
}

export class Transaction {
  constructor(
    private readonly store: Firestore,
    readonly id: string,
  ) {}

  getAll(paths: string[]): Promise<(Doc | undefined)[]> {
    return this.store.getAll(paths, this.id)
  }
}

export class NotFound extends Error {}
export class Conflict extends Error {}

async function peekStatus(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { error?: { status?: string } }
    return body.error?.status
  } catch {
    return undefined
  }
}
