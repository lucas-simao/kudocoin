import { useEffect, useState } from 'react'
import { api, ApiError, type Role, type Settings } from '@/api/client'
import { useSession } from '@/auth/session'
import { Avatar, Button, Card, ConfirmButton, Field, Heading, Input, Notice, Spinner, Toggle } from '@/components/ui'
import { useI18n } from '@/i18n'
import { type Member, type Org, type Season, todayIn, useInviteToken, useMembers, useSeason } from '@/lib/data'
import { Link, navigate } from '@/lib/router'
import { GiveForm } from '../org/GiveForm'
import { WithOrg } from '../org/OrgPage'

export function SettingsPage({ slug }: { slug: string }) {
  return <WithOrg slug={slug}>{(org) => <OrgSettings org={org} />}</WithOrg>
}

function useAction() {
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

function OrgSettings({ org }: { org: Org }) {
  const { user } = useSession()
  const { t } = useI18n()
  const members = useMembers(org.id)
  const season = useSeason(org.id, org.seasonId)
  const me = members?.find((member) => member.uid === user?.uid)
  if (!members || !season || !me) return <Spinner label={t('common.loading')} />
  const isAdmin = me.role !== 'member'
  return (
    <div className="flex flex-col gap-6">
      <Link to={{ name: 'org', slug: org.slug }} className="text-sm text-coin-text hover:underline">
        ← {org.name}
      </Link>
      <Heading as="h1">{t('settings.title')}</Heading>
      {isAdmin ? (
        <>
          <General org={org} season={season} />
          <Invite org={org} />
          <Slack org={org} />
          <Card className="flex flex-col gap-4">
            <Heading>{t('settings.award')}</Heading>
            <p className="text-sm text-muted">{t('settings.awardHint')}</p>
            <GiveForm org={org} members={members} myUid={me.uid} left={0} kind="award" />
          </Card>
          <People org={org} members={members} me={me} />
          <CloseSeason org={org} season={season} />
        </>
      ) : null}
      {me.role !== 'owner' ? <Leave org={org} me={me} /> : null}
    </div>
  )
}

function General({ org, season }: { org: Org; season: Season }) {
  const { t } = useI18n()
  const [name, setName] = useState(org.name)
  const [settings, setSettings] = useState<Settings>(org.settings)
  const [endsOn, setEndsOn] = useState(season.endsOn)
  const [prize, setPrize] = useState(season.prize)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const { problem, run } = useAction()
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSaved(false)
    setSettings((current) => ({ ...current, [key]: value }))
  }
  const whole = (value: string) => Math.max(0, Math.round(Number(value) || 0))
  return (
    <Card className="flex flex-col gap-5">
      <Heading>{t('settings.general')}</Heading>
      <Field label={t('create.name')}>{(id) => <Input id={id} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />}</Field>
      <Field label={t('create.coinName')}>{(id) => <Input id={id} maxLength={24} value={settings.coinName} onChange={(event) => set('coinName', event.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('create.dailyAllowance')}>
          {(id) => <Input id={id} type="number" min={1} max={100} value={settings.dailyAllowance} onChange={(event) => set('dailyAllowance', whole(event.target.value))} />}
        </Field>
        <Field label={t('create.maxPerGive')}>
          {(id) => <Input id={id} type="number" min={1} max={settings.dailyAllowance} value={settings.maxPerGive} onChange={(event) => set('maxPerGive', whole(event.target.value))} />}
        </Field>
        <Field label={t('create.maxReceivedPerDay')}>
          {(id) => <Input id={id} type="number" min={1} max={1000} value={settings.maxReceivedPerDay} onChange={(event) => set('maxReceivedPerDay', whole(event.target.value))} />}
        </Field>
      </div>
      <Toggle checked={settings.reasonRequired} onChange={(value) => set('reasonRequired', value)} label={t('create.reasonRequired')} />
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label={t('create.endsOn')}>{(id) => <Input id={id} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />}</Field>
        <Field label={t('create.prize')}>{(id) => <Input id={id} maxLength={200} value={prize} onChange={(event) => setPrize(event.target.value)} />}</Field>
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {saved ? <Notice tone="done">{t('common.saved')}</Notice> : null}
      <div>
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await run(() =>
              api.updateOrg(org.id, {
                name,
                settings,
                season: { ...(endsOn !== season.endsOn ? { endsOn } : {}), prize },
              }),
            )
            setBusy(false)
            setSaved(ok)
          }}
        >
          {t('common.save')}
        </Button>
      </div>
    </Card>
  )
}

function Invite({ org }: { org: Org }) {
  const { t } = useI18n()
  const token = useInviteToken(org.id, true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const { problem, run } = useAction()
  const link = token ? `${window.location.origin}/join/${token}` : ''
  const make = async () => {
    setBusy(true)
    await run(() => api.newInvite(org.id))
    setBusy(false)
    setCopied(false)
  }
  return (
    <Card className="flex flex-col gap-4">
      <Heading>{t('settings.invite')}</Heading>
      <p className="text-sm text-muted">{t('settings.inviteHint')}</p>
      {token === undefined ? <Spinner label={t('common.loading')} /> : null}
      {token === null ? <p className="text-sm text-subtle">{t('settings.inviteNone')}</p> : null}
      {token ? (
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={link} className="flex-1 font-mono text-sm" onFocus={(event) => event.target.select()} aria-label={t('settings.invite')} />
          <Button
            variant="quiet"
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            }}
          >
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>
      ) : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} onClick={make}>
          {token ? t('settings.inviteNew') : t('settings.inviteCreate')}
        </Button>
        {token ? (
          <Button variant="quiet" onClick={() => run(() => api.turnOffInvite(org.id))}>
            {t('settings.inviteOff')}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

const OUTCOMES = ['connected', 'cancelled', 'taken', 'error'] as const
type Outcome = (typeof OUTCOMES)[number]

/** Connecting a Slack workspace (docs/decisions/slack.md). Shown once the API has Slack set up. */
function Slack({ org }: { org: Org }) {
  const { t } = useI18n()
  const [available, setAvailable] = useState<boolean>()
  const [busy, setBusy] = useState(false)
  const { problem, run } = useAction()
  // Slack sends the admin back with ?slack=<outcome>; say it once and tidy the address.
  const [outcome] = useState<Outcome | undefined>(() => {
    const value = new URLSearchParams(window.location.search).get('slack')
    return OUTCOMES.find((item) => item === value)
  })
  useEffect(() => {
    if (outcome) window.history.replaceState(null, '', window.location.pathname)
    api.health().then((health) => setAvailable(Boolean(health.slack)))
  }, [outcome])
  if (!available && !org.slack && !outcome) return null
  return (
    <Card className="flex flex-col gap-4">
      <Heading>{t('slack.title')}</Heading>
      {outcome ? <Notice tone={outcome === 'connected' ? 'done' : outcome === 'cancelled' ? 'info' : 'error'}>{t(`slack.outcome.${outcome}`)}</Notice> : null}
      {org.slack ? (
        <>
          <p className="font-semibold">{t('slack.connected', { name: org.slack.teamName })}</p>
          <p className="text-sm text-muted">{t('slack.howTo')}</p>
          <Toggle checked={org.slack.announce} onChange={(value) => run(() => api.slackAnnounce(org.id, value))} label={t('slack.announce')} />
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <div>
            <ConfirmButton
              label={t('slack.disconnect')}
              question={t('slack.disconnectConfirm', { name: org.slack.teamName })}
              confirmLabel={t('slack.disconnect')}
              cancelLabel={t('common.cancel')}
              onConfirm={() => run(() => api.slackDisconnect(org.id))}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{t('slack.hint')}</p>
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          {available ? (
            <div>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true)
                  let url = ''
                  await run(async () => {
                    url = (await api.slackInstall(org.id)).url
                  })
                  if (url) window.location.assign(url)
                  else setBusy(false)
                }}
              >
                {t('slack.add')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}

function People({ org, members, me }: { org: Org; members: Member[]; me: Member }) {
  const { t } = useI18n()
  const { problem, run } = useAction()
  const canManage = (member: Member) => member.uid !== me.uid && member.role !== 'owner' && (me.role === 'owner' || member.role === 'member')
  const role = (member: Member, next: Role) => run(() => api.setRole(org.id, member.uid, next))
  return (
    <Card className="flex flex-col gap-4">
      <Heading>{t('settings.members')}</Heading>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <ul className="flex flex-col divide-y divide-line-subtle">
        {members.map((member) => (
          <li key={member.uid} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar name={member.name} picture={member.picture} />
            <span className="flex min-w-40 flex-1 flex-col">
              <span>{member.name}</span>
              <span className="text-xs text-subtle">{t(`orgs.roles.${member.role}`)}</span>
            </span>
            {canManage(member) ? (
              <span className="flex flex-wrap gap-2">
                {member.role === 'member' ? (
                  <Button variant="quiet" onClick={() => role(member, 'admin')}>
                    {t('settings.makeAdmin')}
                  </Button>
                ) : (
                  <Button variant="quiet" onClick={() => role(member, 'member')}>
                    {t('settings.makeMember')}
                  </Button>
                )}
                {me.role === 'owner' ? (
                  <ConfirmButton
                    variant="quiet"
                    label={t('settings.makeOwner')}
                    question={t('settings.ownerConfirm', { name: member.name })}
                    confirmLabel={t('common.confirm')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={() => role(member, 'owner')}
                  />
                ) : null}
                <ConfirmButton
                  label={t('settings.remove')}
                  question={t('settings.removeConfirm', { name: member.name })}
                  confirmLabel={t('settings.remove')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={() => run(() => api.removeMember(org.id, member.uid))}
                />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CloseSeason({ org, season }: { org: Org; season: Season }) {
  const { t, date } = useI18n()
  const today = todayIn(org.settings.timezone)
  const [endsOn, setEndsOn] = useState(`${Number(season.endsOn.slice(0, 4)) + 1}${season.endsOn.slice(4)}`)
  const [prize, setPrize] = useState(season.prize)
  const { problem, run } = useAction()
  const ready = today >= season.endsOn
  return (
    <Card className="flex flex-col gap-4">
      <Heading>{t('settings.closeSeason')}</Heading>
      <p className="text-sm text-muted">{t('settings.closeHint')}</p>
      {ready ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <Field label={t('settings.nextEndsOn')}>{(id) => <Input id={id} type="date" min={today} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />}</Field>
            <Field label={t('settings.nextPrize')}>{(id) => <Input id={id} maxLength={200} value={prize} onChange={(event) => setPrize(event.target.value)} />}</Field>
          </div>
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <div>
            <ConfirmButton
              variant="coin"
              label={t('settings.closeSeason')}
              question={t('settings.closeConfirm', { n: season.number })}
              confirmLabel={t('settings.closeSeason')}
              cancelLabel={t('common.cancel')}
              onConfirm={async () => {
                if (await run(() => api.closeSeason(org.id, { endsOn, prize }))) navigate({ name: 'org', slug: org.slug })
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-subtle">{t('settings.closeNotYet', { date: date(season.endsOn) })}</p>
      )}
    </Card>
  )
}

function Leave({ org, me }: { org: Org; me: Member }) {
  const { t } = useI18n()
  const { problem, run } = useAction()
  return (
    <Card className="flex flex-col gap-3">
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div>
        <ConfirmButton
          label={t('settings.leave')}
          question={t('settings.leaveConfirm', { name: org.name })}
          confirmLabel={t('settings.leave')}
          cancelLabel={t('common.cancel')}
          onConfirm={async () => {
            if (await run(() => api.removeMember(org.id, me.uid))) navigate({ name: 'orgs' })
          }}
        />
      </div>
    </Card>
  )
}
