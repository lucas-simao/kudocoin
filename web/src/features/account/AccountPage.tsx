import { deleteUser } from 'firebase/auth'
import { useState } from 'react'
import { api, ApiError } from '@/api/client'
import { auth } from '@/auth/firebase'
import { useSession } from '@/auth/session'
import { Avatar, Card, ConfirmButton, Heading, Notice } from '@/components/ui'
import { useI18n } from '@/i18n'
import { navigate } from '@/lib/router'

export function AccountPage() {
  const { user, signOut } = useSession()
  const { t, error } = useI18n()
  const [problem, setProblem] = useState<string>()
  if (!user) return null
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Heading as="h1">{t('account.title')}</Heading>
      <Card className="flex items-center gap-4">
        <Avatar name={user.displayName ?? ''} picture={user.photoURL} size={48} />
        <span className="font-semibold">{user.displayName}</span>
      </Card>
      <Card className="flex flex-col gap-3">
        <Heading>{t('account.delete')}</Heading>
        <p className="text-sm text-muted">{t('account.deleteHint')}</p>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <div>
          <ConfirmButton
            label={t('account.delete')}
            question={t('account.deleteConfirm')}
            confirmLabel={t('account.delete')}
            cancelLabel={t('common.cancel')}
            onConfirm={async () => {
              setProblem(undefined)
              try {
                await api.deleteAccount()
                // Firebase may ask for a recent sign-in to delete the user; the data is gone already, so sign out.
                if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => signOut())
                navigate({ name: 'home' }, true)
              } catch (caught) {
                setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
              }
            }}
          />
        </div>
      </Card>
    </div>
  )
}
