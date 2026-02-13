import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { fetchUserSettings } from '../api/settings'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { ThemePreference, fromBackendThemePreference, toBackendThemePreference, useThemeMode } from '../themeMode'
import { ContentType, listContentCategories } from '../api/content'
import {
  NotificationMode,
  NotificationPreferences,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../api/notifications'

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { user, updateSettings, refreshUser } = useAuth()
  const { preference: themePreference, setPreference: setThemePreference } = useThemeMode()
  const [form, setForm] = useState({
    baseCurrency: user?.baseCurrency || 'USD',
    timezone: user?.timezone || 'UTC',
    themePreference
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null)
  const [notificationCategories, setNotificationCategories] = useState<ContentType[]>([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationError, setNotificationError] = useState('')

  useEffect(() => {
    setForm({
      baseCurrency: user?.baseCurrency || 'USD',
      timezone: user?.timezone || 'UTC',
      themePreference: user ? fromBackendThemePreference(user.themePreference) : themePreference
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      fetchUserSettings().then((profile) => setForm({
        baseCurrency: profile.baseCurrency || 'USD',
        timezone: profile.timezone || 'UTC',
        themePreference: fromBackendThemePreference(profile.themePreference)
      })).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    setNotificationLoading(true)
    Promise.all([
      getNotificationPreferences(),
      listContentCategories()
    ])
      .then(([preferences, categories]) => {
        setNotificationPrefs({
          enabled: preferences.enabled,
          notifyOnNew: preferences.notifyOnNew,
          notifyOnUpdates: preferences.notifyOnUpdates,
          mode: preferences.mode || 'ALL',
          categories: preferences.categories || [],
          tags: preferences.tags || [],
          symbols: preferences.symbols || [],
          matchPolicy: preferences.matchPolicy || 'CATEGORY_ONLY'
        })
        setNotificationCategories(categories)
      })
      .catch((err) => {
        const apiErr = err as ApiError
        setNotificationError(translateApiError(apiErr, t))
      })
      .finally(() => setNotificationLoading(false))
  }, [language, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await updateSettings({
        baseCurrency: form.baseCurrency,
        timezone: form.timezone,
        themePreference: toBackendThemePreference(form.themePreference)
      })
      setThemePreference(form.themePreference)
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

  const updateNotificationField = <K extends keyof NotificationPreferences>(field: K, value: NotificationPreferences[K]) => {
    setNotificationPrefs((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [field]: value
      }
    })
  }

  const handleNotificationModeChange = (mode: NotificationMode) => {
    setNotificationPrefs((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        mode
      }
    })
  }

  const handleSaveNotificationPreferences = async () => {
    if (!notificationPrefs) return
    setNotificationSaving(true)
    setNotificationMessage('')
    setNotificationError('')
    try {
      const updated = await updateNotificationPreferences(notificationPrefs)
      setNotificationPrefs({
        enabled: updated.enabled,
        notifyOnNew: updated.notifyOnNew,
        notifyOnUpdates: updated.notifyOnUpdates,
        mode: updated.mode,
        categories: updated.categories || [],
        tags: updated.tags || [],
        symbols: updated.symbols || [],
        matchPolicy: updated.matchPolicy || 'CATEGORY_ONLY'
      })
      setNotificationMessage(t('notifications.settings.messages.saved'))
    } catch (err) {
      const apiErr = err as ApiError
      setNotificationError(translateApiError(apiErr, t))
    } finally {
      setNotificationSaving(false)
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
            <TextField
              select
              label={t('theme.label')}
              value={form.themePreference}
              onChange={(e) => {
                const nextThemePreference = e.target.value as ThemePreference
                setForm((prev) => ({ ...prev, themePreference: nextThemePreference }))
                setThemePreference(nextThemePreference)
              }}
            >
              <MenuItem value="light">{t('theme.light')}</MenuItem>
              <MenuItem value="dark">{t('theme.dark')}</MenuItem>
              <MenuItem value="system">{t('theme.system')}</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? t('settings.messages.saving') : t('settings.actions.save')}</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2} maxWidth={640}>
            <Typography variant="h6">{t('notifications.settings.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('notifications.settings.subtitle')}
            </Typography>

            {notificationMessage && <Alert severity="success">{notificationMessage}</Alert>}
            {notificationError && <Alert severity="error">{notificationError}</Alert>}

            {notificationLoading || !notificationPrefs ? (
              <Typography variant="body2" color="text.secondary">
                {t('common.loading')}
              </Typography>
            ) : (
              <Stack spacing={2.5}>
                <FormGroup>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={notificationPrefs.enabled}
                        onChange={(event) => updateNotificationField('enabled', event.target.checked)}
                      />
                    )}
                    label={t('notifications.settings.enable')}
                  />
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={notificationPrefs.notifyOnNew}
                        onChange={(event) => updateNotificationField('notifyOnNew', event.target.checked)}
                        disabled={!notificationPrefs.enabled}
                      />
                    )}
                    label={t('notifications.settings.notifyOnNew')}
                  />
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={notificationPrefs.notifyOnUpdates}
                        onChange={(event) => updateNotificationField('notifyOnUpdates', event.target.checked)}
                        disabled={!notificationPrefs.enabled}
                      />
                    )}
                    label={t('notifications.settings.notifyOnUpdates')}
                  />
                </FormGroup>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {t('notifications.settings.subscriptionMode')}
                  </Typography>
                  <RadioGroup
                    value={notificationPrefs.mode}
                    onChange={(event) => handleNotificationModeChange(event.target.value as NotificationMode)}
                  >
                    <FormControlLabel
                      value="ALL"
                      control={<Radio />}
                      label={t('notifications.settings.mode.all')}
                      disabled={!notificationPrefs.enabled}
                    />
                    <FormControlLabel
                      value="SELECTED"
                      control={<Radio />}
                      label={t('notifications.settings.mode.selected')}
                      disabled={!notificationPrefs.enabled}
                    />
                  </RadioGroup>
                </Stack>

                {notificationPrefs.mode === 'SELECTED' && (
                  <FormControl fullWidth disabled={!notificationPrefs.enabled}>
                    <InputLabel id="notification-categories-label">
                      {t('notifications.settings.selectCategories')}
                    </InputLabel>
                    <Select
                      labelId="notification-categories-label"
                      multiple
                      value={notificationPrefs.categories}
                      label={t('notifications.settings.selectCategories')}
                      onChange={(event) => {
                        const value = event.target.value
                        const nextCategories = Array.isArray(value)
                          ? value
                          : String(value).split(',')
                        updateNotificationField('categories', nextCategories)
                      }}
                      renderValue={(selected) => {
                        const selectedIds = selected as string[]
                        if (selectedIds.length === 0) {
                          return t('notifications.settings.noCategoriesSelected')
                        }
                        const labels = notificationCategories
                          .filter((category) => selectedIds.includes(category.id))
                          .map((category) => category.displayName)
                        return labels.join(', ')
                      }}
                    >
                      {notificationCategories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          <Checkbox checked={notificationPrefs.categories.includes(category.id)} />
                          <ListItemText primary={category.displayName} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Typography variant="caption" color="text.secondary">
                  {t('notifications.settings.helper')}
                </Typography>

                <Button
                  variant="contained"
                  onClick={handleSaveNotificationPreferences}
                  disabled={notificationSaving}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {notificationSaving ? t('settings.messages.saving') : t('notifications.settings.actions.save')}
                </Button>
              </Stack>
            )}
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
