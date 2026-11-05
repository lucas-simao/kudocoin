import { type FormEvent, useMemo, useState } from 'react'
import { api, ApiError, type Settings } from '@/api/client'
import { Button, Card, Field, Heading, Input, Notice, Select, Toggle } from '@/components/ui'
import { useI18n } from '@/i18n'
import { todayIn } from '@/lib/data'
import { navigate } from '@/lib/router'
import { slugify } from '@/lib/slug'

function zones(): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
  return all && all.length ? all : ['America/Sao_Paulo', 'UTC']
}

export function CreateOrg() {
  const { t, error } = useI18n()
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    coinName: 'Kudocoin',
    dailyAllowance: 5,
    maxPerGive: 5,
    maxReceivedPerDay: 20,
    reasonRequired: true,
    timezone: browserZone,
  })
  const today = todayIn(settings.timezone)
  const [endsOn, setEndsOn] = useState(() => (today.slice(5) >= '12-01' ? `${Number(today.slice(0, 4)) + 1}-12-31` : `${today.slice(0, 4)}-12-31`))
  const [prize, setPrize] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const zoneList = useMemo(zones, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const whole = (value: string) => Math.max(0, Math.round(Number(value) || 0))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setProblem(undefined)
    try {
      const created = await api.createOrg({ name, slug, settings, season: { endsOn, prize } })
      navigate({ name: 'org', slug: created.slug })
    } catch (caught) {
      setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <Heading as="h1">{t('create.title')}</Heading>
      <Card className="flex flex-col gap-5">
        <Field label={t('create.name')}>
          {(id) => (
            <Input
              id={id}
              required
              minLength={2}
              maxLength={60}
              value={name}
              placeholder={t('create.namePlaceholder')}
              onChange={(event) => {
                setName(event.target.value)
                if (!slugTouched) setSlug(slugify(event.target.value))
              }}
            />
          )}
        </Field>
        <Field label={t('create.slug')} hint={t('create.slugHint')}>
          {(id, describedBy) => (
            <div className="flex items-center gap-1">
              <span className="text-subtle">/o/</span>
              <Input
                id={id}
                aria-describedby={describedBy}
                required
                pattern="[a-z][a-z0-9-]{2,39}"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value.toLowerCase())
                }}
              />
            </div>
          )}
        </Field>
        <Field label={t('create.coinName')} hint={t('create.coinNameHint')}>
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} required maxLength={24} value={settings.coinName} onChange={(event) => set('coinName', event.target.value)} />
          )}
        </Field>
      </Card>

      <Card className="flex flex-col gap-5">
        <Heading>{t('create.rules')}</Heading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('create.dailyAllowance')}>
            {(id) => <Input id={id} type="number" min={1} max={100} inputMode="numeric" value={settings.dailyAllowance} onChange={(event) => set('dailyAllowance', whole(event.target.value))} />}
          </Field>
          <Field label={t('create.maxPerGive')}>
            {(id) => <Input id={id} type="number" min={1} max={settings.dailyAllowance} inputMode="numeric" value={settings.maxPerGive} onChange={(event) => set('maxPerGive', whole(event.target.value))} />}
          </Field>
          <Field label={t('create.maxReceivedPerDay')}>
            {(id) => <Input id={id} type="number" min={1} max={1000} inputMode="numeric" value={settings.maxReceivedPerDay} onChange={(event) => set('maxReceivedPerDay', whole(event.target.value))} />}
          </Field>
        </div>
        <Toggle checked={settings.reasonRequired} onChange={(value) => set('reasonRequired', value)} label={t('create.reasonRequired')} />
        <Field label={t('create.timezone')} hint={t('create.timezoneHint')}>
          {(id, describedBy) => (
            <Select id={id} aria-describedby={describedBy} value={settings.timezone} onChange={(event) => set('timezone', event.target.value)}>
              {zoneList.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      <Card className="flex flex-col gap-5">
        <Heading>{t('create.season')}</Heading>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label={t('create.endsOn')}>{(id) => <Input id={id} type="date" required min={today} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />}</Field>
          <Field label={t('create.prize')}>
            {(id) => <Input id={id} maxLength={200} value={prize} placeholder={t('create.prizePlaceholder')} onChange={(event) => setPrize(event.target.value)} />}
          </Field>
        </div>
      </Card>

      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex gap-3">
        <Button type="submit" busy={busy}>
          {t('create.submit')}
        </Button>
        <Button variant="quiet" onClick={() => navigate({ name: 'orgs' })}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
