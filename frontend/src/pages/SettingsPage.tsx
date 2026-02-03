import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { fetchUserSettings } from '../api/settings'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import PageHeader from '../components/ui/PageHeader'

export default function SettingsPage() {
  const { user, updateSettings, refreshUser } = useAuth()
  const [form, setForm] = useState({
    baseCurrency: user?.baseCurrency || 'USD',
    timezone: user?.timezone || 'UTC'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    setForm({
      baseCurrency: user?.baseCurrency || 'USD',
      timezone: user?.timezone || 'UTC'
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      fetchUserSettings().then((profile) => setForm({
        baseCurrency: profile.baseCurrency || 'USD',
        timezone: profile.timezone || 'UTC'
      })).catch(() => {})
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await updateSettings(form)
      await refreshUser()
      setMessage('Settings saved and synced across the app')
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordMessage('')
    setPasswordError('')
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      setPasswordSaving(false)
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      setPasswordSaving(false)
      return
    }
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordMessage('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      const apiErr = err as ApiError
      setPasswordError(apiErr.message || 'Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Settings"
        subtitle="Update your base currency and timezone; changes apply everywhere including dashboard and trades."
      />
      <Card>
        <CardContent>
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack component="form" spacing={2} onSubmit={handleSubmit} maxWidth={420}>
            <TextField
              label="Base currency"
              value={form.baseCurrency}
              onChange={(e) => setForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
              helperText="ISO currency code (e.g., USD, EUR, GBP)"
              required
            />
            <TextField
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              helperText="IANA timezone (e.g., Europe/Bucharest)"
              required
            />
            <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={handlePasswordSubmit} maxWidth={420}>
            <Typography variant="h6">Change password</Typography>
            <Typography variant="body2" color="text.secondary">
              Update your password regularly to keep your journal secure.
            </Typography>
            {passwordMessage && <Alert severity="success">{passwordMessage}</Alert>}
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField
              label="Current password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              required
            />
            <TextField
              label="New password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              helperText="Minimum 8 characters"
              required
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              required
            />
            <Button type="submit" variant="contained" disabled={passwordSaving}>
              {passwordSaving ? 'Updating…' : 'Update password'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Account deletion</Typography>
            <Typography variant="body2" color="text.secondary">
              Request deletion of your account and data. This workflow is coming soon.
            </Typography>
            <Button variant="outlined" disabled>
              Delete account (coming soon)
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
