// Requests (docs/decisions/claims-and-requests.md): asking another member for coins. The one asked pays (a
// give from their allowance) or declines; the one who asked can cancel.
import { useRef, useState } from 'react'
import { api, ApiError, entryKey } from '@/api/client'
import { Button, Card, Field, Heading, Input, Notice, Select, TextArea } from '@/components/ui'
import { LinkedText } from '@/components/LinkedText'
import { useI18n } from '@/i18n'
import { clamp } from '@/lib/amount'
import { type CoinRequest, type Member, type Org, todayIn, useOpenRequests } from '@/lib/data'

const MAX_REASON = 280

function useProblem() {
  const { t, error } = useI18n()
  const [problem, setProblem] = useState<string>()
  const run = async (work: () => Promise<unknown>) => {
    setProblem(undefined)
    try {
      await work()
      return true
    } catch (caught) {
      setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
      return false
    }
  }
  return { problem, run }
}

export function Requests({ org, members, me }: { org: Org; members: Member[]; me: Member }) {
  const { t } = useI18n()
  const requests = useOpenRequests(org.id, me.uid)
  const [asking, setAsking] = useState(false)
  if (!requests) return null
  const { toMe, mine } = requests
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading>{t('request.title')}</Heading>
        <p className="text-sm text-muted">{t('request.hint')}</p>
      </div>
      {toMe.length === 0 && mine.length === 0 && !asking ? <p className="text-sm text-subtle">{t('request.none')}</p> : null}
      {toMe.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t('request.toMe')}</h3>
          <ul className="flex flex-col divide-y divide-line-subtle">
            {toMe.map((request) => (
              <RequestRow key={request.id} request={request} org={org} toMe />
            ))}
          </ul>
        </section>
      ) : null}
      {mine.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t('request.mine')}</h3>
          <ul className="flex flex-col divide-y divide-line-subtle">
            {mine.map((request) => (
              <RequestRow key={request.id} request={request} org={org} toMe={false} />
            ))}
          </ul>
        </section>
      ) : null}
      {asking ? (
        <AskForm org={org} members={members} me={me} onDone={() => setAsking(false)} />
      ) : (
        <div>
          <Button variant="quiet" onClick={() => setAsking(true)}>
            {t('request.ask')}
          </Button>
        </div>
      )}
    </Card>
  )
}

function RequestRow({ request, org, toMe }: { request: CoinRequest; org: Org; toMe: boolean }) {
  const { t, number } = useI18n()
  const { problem, run } = useProblem()
  const [busy, setBusy] = useState<string>()
  const today = todayIn(org.settings.timezone)
  const days = Math.round((Date.parse(`${request.expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const expired = days < 0
  const when = expired ? t('bounty.expired') : days === 0 ? t('bounty.lastDay') : t('bounty.daysLeft', { n: days })
  const answer = async (kind: 'pay' | 'decline' | 'cancel') => {
    setBusy(kind)
    await run(() => api.answerRequest(org.id, request.id, kind))
    setBusy(undefined)
  }
  const amount = `${number(request.amount)} ${org.settings.coinName}`
  return (
    <li className="flex flex-col gap-2 py-3">
      <p className="text-[0.9375rem]">
        {toMe
          ? t('request.asksYou', { name: request.fromName || t('common.formerMember'), amount })
          : t('request.youAsked', { name: request.toName || t('common.formerMember'), amount })}
      </p>
      <p className="text-sm text-muted">
        “<LinkedText text={request.reason} />” · <span className={expired ? 'text-alert-text' : ''}>{when}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {toMe ? (
          <>
            {expired ? null : (
              <Button variant="coin" busy={busy === 'pay'} onClick={() => answer('pay')}>
                {t('request.pay', { amount })}
              </Button>
            )}
            <Button variant="quiet" busy={busy === 'decline'} onClick={() => answer('decline')}>
              {t('request.decline')}
            </Button>
          </>
        ) : (
          <Button variant="quiet" busy={busy === 'cancel'} onClick={() => answer('cancel')}>
            {t('request.cancel')}
          </Button>
        )}
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
    </li>
  )
}

function AskForm({ org, members, me, onDone }: { org: Org; members: Member[]; me: Member; onDone: () => void }) {
  const { t, number } = useI18n()
  const max = org.settings.maxPerGive
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState('1')
  const amount = clamp(Number.parseInt(draft, 10), max)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { problem, run } = useProblem()
  // One key per attempt: a double tap asks once.
  const key = useRef(entryKey())
  const others = members.filter((member) => member.uid !== me.uid)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        if (await run(() => api.askCoins(org.id, { to, amount, reason: reason.trim(), key: key.current }))) onDone()
        else {
          key.current = entryKey()
          setBusy(false)
        }
      }}
    >
      <Field label={t('request.who')}>
        {(id) => (
          <Select id={id} required value={to} onChange={(event) => setTo(event.target.value)}>
            <option value="">{t('give.toPlaceholder')}</option>
            {others.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('give.amount')} hint={t('give.upTo', { n: number(max) })}>
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={() => setDraft(String(amount))}
          />
        )}
      </Field>
      <Field label={t('give.reason')}>
        {(id) => (
          <TextArea
            id={id}
            rows={2}
            required
            maxLength={MAX_REASON}
            placeholder={t('request.reasonPlaceholder')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="coin" busy={busy} disabled={!to || !reason.trim()}>
          {t('request.send', { amount: `${number(amount)} ${org.settings.coinName}` })}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
