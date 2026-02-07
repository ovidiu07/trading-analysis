import { Card, CardContent, Divider, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import EmptyState from '../components/ui/EmptyState'
import { useI18n } from '../i18n'

export default function ProfilePage() {
  const { t } = useI18n()
  const { user } = useAuth()

  if (!user) {
    return (
      <EmptyState
        title={t('profile.emptyTitle')}
        description={t('profile.emptyDescription')}
      />
    )
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">{t('profile.fields.email')}</Typography>
            <Typography>{user.email}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">{t('profile.fields.role')}</Typography>
            <Typography>{user.role || t('common.na')}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">{t('profile.fields.baseCurrency')}</Typography>
            <Typography>{user.baseCurrency || t('common.na')}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">{t('profile.fields.timezone')}</Typography>
            <Typography>{user.timezone || t('common.na')}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {t('profile.passwordComingSoon')}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
