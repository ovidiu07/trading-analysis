import { Card, CardContent, Divider, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <EmptyState
        title="No user information available"
        description="Please sign in again to view profile details."
      />
    )
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Profile" subtitle="View your account details and preferences." />
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">Email</Typography>
            <Typography>{user.email}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">Role</Typography>
            <Typography>{user.role || '—'}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">Base currency</Typography>
            <Typography>{user.baseCurrency || '—'}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">Timezone</Typography>
            <Typography>{user.timezone || '—'}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Change password functionality coming soon.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
