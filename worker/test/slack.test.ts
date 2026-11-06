import { describe, expect, it } from 'vitest'
import { fromSlack, readToken, seal, signToken, unseal } from '../src/slack/crypto'
import { fill, SLACK_MESSAGES } from '../src/slack/messages'
import { escape, parseKudos, parseRequest, plainText } from '../src/slack/parse'

const KEY = 'test-key'

async function slackHeaders(secret: string, body: string, timestamp: number): Promise<Headers> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v0:${timestamp}:${body}`))
  const hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return new Headers({ 'x-slack-request-timestamp': String(timestamp), 'x-slack-signature': `v0=${hex}` })
}

describe('signed tokens', () => {
  it('reads back what was signed, for its purpose, until it expires', async () => {
    const now = 1_800_000_000_000
    const token = await signToken(KEY, 'link', { t: 'T1', u: 'U1' }, 900, now)
    expect(await readToken(KEY, 'link', token, now + 1000)).toMatchObject({ t: 'T1', u: 'U1', p: 'link' })
    expect(await readToken(KEY, 'install', token, now)).toBe(null)
    expect(await readToken(KEY, 'link', token, now + 901_000)).toBe(null)
    expect(await readToken('other-key', 'link', token, now)).toBe(null)
  })

  it('refuses a token whose payload was changed', async () => {
    const token = await signToken(KEY, 'install', { o: 'org-a', a: 'ana' }, 600)
    const [, signature] = token.split('.')
    const forged = btoa(JSON.stringify({ o: 'org-b', a: 'ana', p: 'install', e: 9_999_999_999 })).replace(/=+$/, '')
    expect(await readToken(KEY, 'install', `${forged}.${signature}`)).toBe(null)
    expect(await readToken(KEY, 'install', 'nonsense')).toBe(null)
    expect(await readToken(KEY, 'install', 42)).toBe(null)
  })
})

describe('sealing', () => {
  it('opens only with the same key, and never repeats', async () => {
    const one = await seal(KEY, 'xoxb-secret')
    const two = await seal(KEY, 'xoxb-secret')
    expect(one).not.toBe(two)
    expect(one).not.toContain('xoxb')
    expect(await unseal(KEY, one)).toBe('xoxb-secret')
    expect(await unseal('other-key', one)).toBe(null)
  })
})

describe("Slack's signature", () => {
  const body = 'team_id=T1&user_id=U1&text=hi'
  const now = 1_800_000_000_000
  const ts = now / 1000

  it('accepts a fresh, correctly signed request', async () => {
    expect(await fromSlack('secret', await slackHeaders('secret', body, ts), body, now)).toBe(true)
  })

  it('refuses another secret, a changed body, an old request and missing headers', async () => {
    expect(await fromSlack('secret', await slackHeaders('wrong', body, ts), body, now)).toBe(false)
    expect(await fromSlack('secret', await slackHeaders('secret', body, ts), `${body}x`, now)).toBe(false)
    expect(await fromSlack('secret', await slackHeaders('secret', body, ts - 301), body, now)).toBe(false)
    expect(await fromSlack('secret', new Headers(), body, now)).toBe(false)
  })
})

describe('/kudos text', () => {
  it('reads the person, the amount and the reason', () => {
    expect(parseKudos('<@U123|ana> 3 reviewed my PR')).toEqual({ slackUserId: 'U123', amount: 3, reason: 'reviewed my PR' })
    expect(parseKudos('<@U123> thanks for the help')).toEqual({ slackUserId: 'U123', amount: 1, reason: 'thanks for the help' })
    expect(parseKudos('<@W9ABC|bo>   2')).toEqual({ slackUserId: 'W9ABC', amount: 2, reason: '' })
    expect(parseKudos('<@U123|ana> 2024 was a great year')).toEqual({ slackUserId: 'U123', amount: 2024, reason: 'was a great year' })
    expect(parseKudos('<@U123|ana> 3x faster build')).toEqual({ slackUserId: 'U123', amount: 1, reason: '3x faster build' })
  })

  it('needs a person first', () => {
    expect(parseKudos('')).toBe(null)
    expect(parseKudos('help')).toBe(null)
    expect(parseKudos('3 <@U123|ana>')).toBe(null)
  })

  it("turns Slack's markup into plain words, and back to safe text", () => {
    expect(plainText('pairing with <@U9|bia> in <#C1|dev> &amp; <https://x.dev|the docs> <!channel>')).toBe(
      'pairing with @bia in #dev & the docs @channel',
    )
    expect(escape('<!channel> & <@U1>')).toBe('&lt;!channel&gt; &amp; &lt;@U1&gt;')
  })
})

describe('what /kudos is asked', () => {
  it('reads help, the summary and a give, in any of the three languages', () => {
    expect(parseRequest('')).toEqual({ kind: 'help' })
    expect(parseRequest('  Help ')).toEqual({ kind: 'help' })
    expect(parseRequest('ajuda')).toEqual({ kind: 'help' })
    expect(parseRequest('summary')).toEqual({ kind: 'summary', share: false })
    expect(parseRequest('resumo compartilhar')).toEqual({ kind: 'summary', share: true })
    expect(parseRequest('SUMMARY share')).toEqual({ kind: 'summary', share: true })
    expect(parseRequest('<@U123|ana> 2 thanks')).toEqual({ kind: 'give', kudos: { slackUserId: 'U123', amount: 2, reason: 'thanks' } })
  })

  it('reads the bounty commands', () => {
    expect(parseRequest('bounties')).toEqual({ kind: 'bounties' })
    expect(parseRequest('recompensas')).toEqual({ kind: 'bounties' })
    expect(parseRequest('bounty 3 fix the flaky test')).toEqual({ kind: 'bountyOffer', amount: 3, task: 'fix the flaky test' })
    expect(parseRequest('recompensa 2 arrumar o deploy')).toEqual({ kind: 'bountyOffer', amount: 2, task: 'arrumar o deploy' })
    expect(parseRequest('bounty pay #7 <@U123|bruno>')).toEqual({ kind: 'bountyPay', number: 7, slackUserId: 'U123' })
    expect(parseRequest('recompensa pagar 7 <@U123>')).toEqual({ kind: 'bountyPay', number: 7, slackUserId: 'U123' })
    expect(parseRequest('bounty cancel #7')).toEqual({ kind: 'bountyCancel', number: 7 })
    expect(parseRequest('bounty fix it')).toEqual({ kind: 'unknown' })
  })

  it('does not guess', () => {
    expect(parseRequest('summary please now')).toEqual({ kind: 'unknown' })
    expect(parseRequest('thanks @ana')).toEqual({ kind: 'unknown' })
  })
})

describe('Slack messages', () => {
  it('have every sentence in every language, with the same placeholders', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((found) => found[1]).sort()
    const flat = (messages: object, prefix = ''): [string, string][] =>
      Object.entries(messages).flatMap(([key, value]) => (typeof value === 'string' ? [[`${prefix}${key}`, value]] : flat(value, `${prefix}${key}.`)))
    const source = new Map(flat(SLACK_MESSAGES['pt-BR']))
    for (const lang of ['en', 'es'] as const) {
      const other = new Map(flat(SLACK_MESSAGES[lang]))
      expect([...other.keys()].sort()).toEqual([...source.keys()].sort())
      for (const [key, text] of source) expect(placeholders(other.get(key)!), `${lang} ${key}`).toEqual(placeholders(text))
    }
    expect(fill(SLACK_MESSAGES.en.errors.allowance_exceeded, { left: 2 })).toBe('You can only give 2 more today.')
  })
})
