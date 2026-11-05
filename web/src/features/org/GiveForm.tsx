import { type FormEvent, useRef, useState } from 'react'
import { api, ApiError, entryKey } from '@/api/client'
import { Button, Field, Input, Notice, Select, TextArea } from '@/components/ui'
import { useI18n } from '@/i18n'
import type { Member, Org } from '@/lib/data'

/**
 * Give coins to another member. The key is made once per attempt, so a double tap or a retry after a
 * timeout writes one entry (docs/decisions/ledger.md).
 */
export function GiveForm({ org, members, myUid, left, kind = 'give' }: { org: Org; members: Member[]; myUid: string; left: number; kind?: 'give' | 'award' }) {
  const { t, error, number } = useI18n()
  const others = members.filter((member) => member.uid !== myUid)
  const max = kind === 'award' ? 1000 : Math.max(1, Math.min(org.settings.maxPerGive, left))
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'done' | 'error'; text: string }>()
  const key = useRef(entryKey())

  if (others.length === 0) return <p className="text-sm text-muted">{t('give.alone')}</p>

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setResult(undefined)
    const receiver = others.find((member) => member.uid === to)
    try {
      const send = kind === 'award' ? api.award : api.give
      await send(org.id, { to, amount, reason, key: key.current })
      setResult({ tone: 'done', text: t('give.sent', { name: receiver?.name ?? '' }) })
      setReason('')
      setAmount(1)
      key.current = entryKey()
    } catch (caught) {
      setResult({ tone: 'error', text: caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic') })
      // A refusal is final for this attempt; the next one is a new give.
      if (caught instanceof ApiError && caught.status !== 0 && caught.status < 500) key.current = entryKey()
    } finally {
      setBusy(false)
    }
  }

  const empty = kind === 'give' && left <= 0
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {kind === 'give' ? <p className="text-sm text-coin-text">{empty ? t('give.noneLeft') : t('give.left', { n: number(left) })}</p> : null}
      <Field label={t('give.to')}>
        {(id) => (
          <Select id={id} required value={to} onChange={(event) => setTo(event.target.value)} disabled={empty}>
            <option value="" disabled>
              {t('give.toPlaceholder')}
            </option>
            {others.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('give.amount')}>
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            required
            disabled={empty}
            value={amount}
            onChange={(event) => setAmount(Math.max(1, Math.round(Number(event.target.value) || 1)))}
          />
        )}
      </Field>
      <Field label={t('give.reason')}>
        {(id) => (
          <TextArea
            id={id}
            maxLength={280}
            required={org.settings.reasonRequired || kind === 'award'}
            disabled={empty}
            value={reason}
            placeholder={t('give.reasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
      <Button type="submit" busy={busy} disabled={empty || !to}>
        {kind === 'award' ? t('settings.awardSubmit') : t('give.submit', { amount: `${number(amount)} ${org.settings.coinName}` })}
      </Button>
    </form>
  )
}
