import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { fetchUserSettings } from '../api/settings'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
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
      setMessage(t('settings.messages.saved'))
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
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
      setPasswordError(t('settings.password.errors.short'))
      setPasswordSaving(false)
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('settings.password.errors.mismatch'))
      setPasswordSaving(false)
      return
    }
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordMessage(t('settings.password.messages.updated'))
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      const apiErr = err as ApiError
      setPasswordError(translateApiError(apiErr, t))
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack component="form" spacing={2} onSubmit={handleSubmit} maxWidth={420}>
            <TextField
              label={t('settings.baseCurrency')}
              value={form.baseCurrency}
              onChange={(e) => setForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
              helperText={t('settings.baseCurrencyHint')}
              required
            />
            <TextField
              label={t('settings.timezone')}
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              helperText={t('settings.timezoneHint')}
              required
            />
            <TextField
              select
              label={t('language.label')}
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ro')}
            >
              <MenuItem value="en">{t('language.english')}</MenuItem>
              <MenuItem value="ro">{t('language.romanian')}</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? t('settings.messages.saving') : t('settings.actions.save')}</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={handlePasswordSubmit} maxWidth={420}>
            <Typography variant="h6">{t('settings.password.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.password.subtitle')}
            </Typography>
            {passwordMessage && <Alert severity="success">{passwordMessage}</Alert>}
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField
              label={t('settings.password.current')}
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              required
            />
            <TextField
              label={t('settings.password.new')}
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              helperText={t('settings.password.minHint')}
              required
            />
            <TextField
              label={t('settings.password.confirm')}
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              required
            />
            <Button type="submit" variant="contained" disabled={passwordSaving}>
              {passwordSaving ? t('auth.updating') : t('settings.password.updateAction')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">{t('settings.delete.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.delete.subtitle')}
            </Typography>
            <Button variant="outlined" disabled>
              {t('settings.delete.action')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
