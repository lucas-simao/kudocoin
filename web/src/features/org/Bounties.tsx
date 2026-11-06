// Bounties (docs/decisions/bounties.md): coins offered for a task from today's allowance, paid to whoever did
// it. The one who offered it, or an admin, pays or cancels.
import { useRef, useState } from 'react'
import { api, ApiError, entryKey } from '@/api/client'
import { Button, Card, ConfirmButton, Field, Heading, Input, Notice, Select, TextArea } from '@/components/ui'
import { useI18n } from '@/i18n'
import { clamp } from '@/lib/amount'
import { type Bounty, type Member, type Org, todayIn, useOpenBounties } from '@/lib/data'

const MAX_TASK = 280

function useProblem() {
  const { t, error } = useI18n()
  const [problem, setProblem] = useState<string>()
  const explain = (caught: unknown) => setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
  return { problem, setProblem, explain }
}

export function Bounties({ org, members, me, left }: { org: Org; members: Member[]; me: Member; left: number }) {
  const { t } = useI18n()
  const bounties = useOpenBounties(org.id)
  const [offering, setOffering] = useState(false)
  if (bounties === undefined) return null
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading>{t('bounty.title')}</Heading>
        <p className="text-sm text-muted">{t('bounty.hint')}</p>
      </div>
      {bounties.length === 0 && !offering ? <p className="text-sm text-subtle">{t('bounty.none')}</p> : null}
      {bounties.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {bounties.map((bounty) => (
            <BountyRow key={bounty.id} bounty={bounty} org={org} members={members} me={me} />
          ))}
        </ul>
      ) : null}
      {offering ? (
        <OfferForm org={org} left={left} onDone={() => setOffering(false)} />
      ) : (
        <div>
          <Button variant="quiet" disabled={left < 1} onClick={() => setOffering(true)}>
            {t('bounty.offer')}
          </Button>
        </div>
      )}
    </Card>
  )
}

function BountyRow({ bounty, org, members, me }: { bounty: Bounty; org: Org; members: Member[]; me: Member }) {
  const { t, number } = useI18n()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const { problem, setProblem, explain } = useProblem()
  const today = todayIn(org.settings.timezone)
  const days = Math.round((Date.parse(`${bounty.expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const claims = Object.entries(bounty.claims ?? {}).sort(([, a], [, b]) => a.at.toDate().getTime() - b.at.toDate().getTime())
  // A claim keeps the bounty payable past its last day.
  const expired = days < 0 && claims.length === 0
  const when = days < 0 ? t('bounty.expired') : days === 0 ? t('bounty.lastDay') : t('bounty.daysLeft', { n: days })
  const mine = bounty.by === me.uid || me.role !== 'member'
  const claimed = claims.some(([uid]) => uid === me.uid)
  const claimants = new Set(claims.map(([uid]) => uid))
  // Who said they did it comes first in the list to pay.
  const others = members
    .filter((member) => member.uid !== bounty.by)
    .sort((a, b) => Number(claimants.has(b.uid)) - Number(claimants.has(a.uid)))
  const payTo = to || (claims.length === 1 ? claims[0][0] : '')
  const autoDays = bounty.autoPayAt ? Math.max(0, Math.ceil((bounty.autoPayAt.toDate().getTime() - Date.now()) / 86_400_000)) : null
  const act = async (work: () => Promise<unknown>) => {
    setProblem(undefined)
    try {
      await work()
    } catch (caught) {
      explain(caught)
    }
  }
  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-[0.9375rem]">
          <span className="text-subtle tabular">#{bounty.number}</span> {bounty.task}
        </p>
        <p className="text-sm text-muted">
          <span className="font-medium text-coin-text tabular">
            {number(bounty.amount)} {org.settings.coinName}
          </span>
          {' · '}
          {t('bounty.by', { name: bounty.byName || t('common.formerMember') })}
          {' · '}
          <span className={days < 0 ? 'text-alert-text' : ''}>{when}</span>
        </p>
      </div>
      {claims.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {claims.map(([uid, claim]) => (
            <li key={uid} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>🙋 {uid === me.uid ? t('bounty.youClaimed') : t('bounty.claimed', { name: claim.name || t('common.formerMember') })}</span>
              {mine && uid !== me.uid ? (
                <button type="button" className="text-subtle underline-offset-4 hover:text-ink hover:underline" onClick={() => act(() => api.rejectClaim(org.id, bounty.id, uid))}>
                  {t('bounty.reject')}
                </button>
              ) : null}
            </li>
          ))}
          {autoDays !== null ? <li className="text-subtle">{t('bounty.autoPay', { n: autoDays })}</li> : null}
        </ul>
      ) : null}
      {bounty.by !== me.uid && !claimed && !expired ? (
        <div>
          <Button variant="quiet" onClick={() => act(() => api.claimBounty(org.id, bounty.id))}>
            {t('bounty.claim')}
          </Button>
        </div>
      ) : null}
      {!mine && problem ? <Notice tone="error">{problem}</Notice> : null}
      {mine ? (
        <div className="flex flex-col gap-2">
          {expired ? null : (
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Select aria-label={t('bounty.payTo')} value={payTo} onChange={(event) => setTo(event.target.value)}>
                  <option value="">{t('bounty.choose')}</option>
                  {others.map((member) => (
                    <option key={member.uid} value={member.uid}>
                      {claimants.has(member.uid) ? `🙋 ${member.name}` : member.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="coin"
                disabled={!payTo}
                busy={busy}
                onClick={async () => {
                  setBusy(true)
                  await act(() => api.payBounty(org.id, bounty.id, payTo))
                  setBusy(false)
                }}
              >
                {t('bounty.pay')}
              </Button>
            </div>
          )}
          {mine && problem ? <Notice tone="error">{problem}</Notice> : null}
          <div>
            <ConfirmButton
              label={t('bounty.cancel')}
              question={t('bounty.cancelConfirm', { number: bounty.number })}
              confirmLabel={t('bounty.cancel')}
              cancelLabel={t('common.back')}
              onConfirm={() => act(() => api.cancelBounty(org.id, bounty.id))}
            />
          </div>
        </div>
      ) : null}
    </li>
  )
}

function OfferForm({ org, left, onDone }: { org: Org; left: number; onDone: () => void }) {
  const { t, number } = useI18n()
  const max = Math.max(1, Math.min(org.settings.maxPerGive, left))
  const [draft, setDraft] = useState('1')
  const amount = clamp(Number.parseInt(draft, 10), max)
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)
  const { problem, setProblem, explain } = useProblem()
  // One key per attempt: a double tap offers once (docs/decisions/ledger.md).
  const key = useRef(entryKey())
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setProblem(undefined)
        try {
          await api.offerBounty(org.id, { amount, task: task.trim(), key: key.current })
          onDone()
        } catch (caught) {
          if (caught instanceof ApiError && caught.status !== 0 && caught.status < 500) key.current = entryKey()
          explain(caught)
          setBusy(false)
        }
      }}
    >
      <Field label={t('bounty.task')}>
        {(id) => (
          <TextArea
            id={id}
            rows={2}
            required
            maxLength={MAX_TASK}
            placeholder={t('bounty.taskPlaceholder')}
            value={task}
            onChange={(event) => setTask(event.target.value)}
          />
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
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="coin" busy={busy} disabled={!task.trim()}>
          {t('bounty.submit', { n: number(amount), coin: org.settings.coinName })}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
