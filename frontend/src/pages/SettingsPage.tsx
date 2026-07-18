import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputAdornment,
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
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser } from '../auth/roles'
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
import PageHero from '../components/ui/PageHero'
import {
  connectOandaProvider,
  disconnectOandaProvider,
  getOandaProviderStatus,
  testOandaProvider,
  type ProviderConnectionStatus
} from '../api/backtest'
import {
  TradingViewWebhookSettingsResponse,
  fetchTradingViewWebhookSettings,
  resetTradingViewWebhookSecret,
  updateTradingViewWebhookSettings
} from '../api/signalIntel'
import {
  fetchAdminChartSettings,
  normalizeIndicatorLines,
  updateAdminChartSettings
} from '../api/chartSettings'

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
  const [oandaTokenDraft, setOandaTokenDraft] = useState('')
  const [providerStatus, setProviderStatus] = useState<ProviderConnectionStatus | null>(null)
  const [providerLoading, setProviderLoading] = useState(false)
  const [providerTesting, setProviderTesting] = useState(false)
  const [providerSaving, setProviderSaving] = useState(false)
  const [providerDisconnecting, setProviderDisconnecting] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  const [providerError, setProviderError] = useState('')
  const [tradingViewSettings, setTradingViewSettings] = useState<TradingViewWebhookSettingsResponse | null>(null)
  const [tradingViewLoading, setTradingViewLoading] = useState(false)
  const [tradingViewSaving, setTradingViewSaving] = useState(false)
  const [tradingViewMessage, setTradingViewMessage] = useState('')
  const [tradingViewError, setTradingViewError] = useState('')
  const [newTradingViewSecret, setNewTradingViewSecret] = useState('')
  const [chartIndicatorsDraft, setChartIndicatorsDraft] = useState('')
  const [chartSettingsLoading, setChartSettingsLoading] = useState(false)
  const [chartSettingsSaving, setChartSettingsSaving] = useState(false)
  const [chartSettingsMessage, setChartSettingsMessage] = useState('')
  const [chartSettingsError, setChartSettingsError] = useState('')

  const isAdmin = isAdminUser(user)

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

  useEffect(() => {
    let mounted = true
    setProviderLoading(true)
    getOandaProviderStatus()
      .then((status) => {
        if (!mounted) return
        setProviderStatus(status)
      })
      .catch((err) => {
        if (!mounted) return
        const apiErr = err as ApiError
        setProviderError(translateApiError(apiErr, t))
      })
      .finally(() => {
        if (mounted) {
          setProviderLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [t])

  useEffect(() => {
    setTradingViewLoading(true)
    fetchTradingViewWebhookSettings()
      .then((settings) => setTradingViewSettings(settings))
      .catch((err) => {
        const apiErr = err as ApiError
        setTradingViewError(translateApiError(apiErr, t))
      })
      .finally(() => setTradingViewLoading(false))
  }, [t])

  useEffect(() => {
    if (!isAdmin) return
    setChartSettingsLoading(true)
    setChartSettingsMessage('')
    setChartSettingsError('')
    fetchAdminChartSettings()
      .then((settings) => setChartIndicatorsDraft((settings.preloadedIndicators || []).join('\n')))
      .catch((err) => {
        const apiErr = err as ApiError
        setChartSettingsError(translateApiError(apiErr, t))
      })
      .finally(() => setChartSettingsLoading(false))
  }, [isAdmin, t])

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

  const refreshProviderStatus = async () => {
    const status = await getOandaProviderStatus()
    setProviderStatus(status)
  }

  const handleTestProvider = async () => {
    if (!oandaTokenDraft.trim()) {
      setProviderError(t('settings.providers.errors.tokenRequired'))
      return
    }
    setProviderTesting(true)
    setProviderMessage('')
    setProviderError('')
    try {
      const status = await testOandaProvider(oandaTokenDraft.trim())
      setProviderStatus((prev) => ({ ...prev, ...status }))
      setProviderMessage(t('settings.providers.messages.testSuccess'))
    } catch (err) {
      const apiErr = err as ApiError
      setProviderError(translateApiError(apiErr, t))
    } finally {
      setProviderTesting(false)
    }
  }

  const handleSaveProvider = async () => {
    if (!oandaTokenDraft.trim()) {
      setProviderError(t('settings.providers.errors.tokenRequired'))
      return
    }
    setProviderSaving(true)
    setProviderMessage('')
    setProviderError('')
    try {
      const status = await connectOandaProvider(oandaTokenDraft.trim())
      setProviderStatus(status)
      setOandaTokenDraft('')
      setProviderMessage(t('settings.providers.messages.connected'))
    } catch (err) {
      const apiErr = err as ApiError
      setProviderError(translateApiError(apiErr, t))
    } finally {
      setProviderSaving(false)
    }
  }

  const handleDisconnectProvider = async () => {
    setProviderDisconnecting(true)
    setProviderMessage('')
    setProviderError('')
    try {
      await disconnectOandaProvider()
      await refreshProviderStatus()
      setProviderMessage(t('settings.providers.messages.disconnected'))
    } catch (err) {
      const apiErr = err as ApiError
      setProviderError(translateApiError(apiErr, t))
    } finally {
      setProviderDisconnecting(false)
    }
  }

  const handleTradingViewToggle = async (enabled: boolean) => {
    setTradingViewSaving(true)
    setTradingViewMessage('')
    setTradingViewError('')
    try {
      const updated = await updateTradingViewWebhookSettings(enabled)
      setTradingViewSettings(updated)
      setTradingViewMessage(enabled ? t('settings.tradingView.messages.enabled') : t('settings.tradingView.messages.disabled'))
    } catch (err) {
      const apiErr = err as ApiError
      setTradingViewError(translateApiError(apiErr, t))
    } finally {
      setTradingViewSaving(false)
    }
  }

  const handleTradingViewResetSecret = async () => {
    setTradingViewSaving(true)
    setTradingViewMessage('')
    setTradingViewError('')
    try {
      const response = await resetTradingViewWebhookSecret()
      setNewTradingViewSecret(response.secret)
      const refreshed = await fetchTradingViewWebhookSettings()
      setTradingViewSettings(refreshed)
      setTradingViewMessage(t('settings.tradingView.messages.reset'))
    } catch (err) {
      const apiErr = err as ApiError
      setTradingViewError(translateApiError(apiErr, t))
    } finally {
      setTradingViewSaving(false)
    }
  }

  const handleCopyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setTradingViewMessage(t('settings.tradingView.messages.copied'))
    } catch {
      setTradingViewError(t('settings.tradingView.messages.copyFailed'))
    }
  }

  const handleSaveChartSettings = async () => {
    const preloadedIndicators = normalizeIndicatorLines(chartIndicatorsDraft)
    if (preloadedIndicators.length === 0) {
      setChartSettingsError(t('settings.chartStudies.required'))
      setChartSettingsMessage('')
      return
    }
    setChartSettingsSaving(true)
    setChartSettingsMessage('')
    setChartSettingsError('')
    try {
      const updated = await updateAdminChartSettings({ preloadedIndicators })
      setChartIndicatorsDraft(updated.preloadedIndicators.join('\n'))
      setChartSettingsMessage(t('settings.chartStudies.saved'))
    } catch (err) {
      const apiErr = err as ApiError
      setChartSettingsError(translateApiError(apiErr, t))
    } finally {
      setChartSettingsSaving(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <PageHero
        eyebrow={t('nav.settings')}
        title={t('settings.heading')}
        description={t('settings.subtitle')}
        icon={<SettingsRoundedIcon fontSize="small" />}
      />

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
              <MenuItem value="black-shiny">{t('theme.blackShiny')}</MenuItem>
              <MenuItem value="system">{t('theme.system')}</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? t('settings.messages.saving') : t('settings.actions.save')}</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {tradingViewMessage && <Alert severity="success" sx={{ mb: 2 }}>{tradingViewMessage}</Alert>}
          {tradingViewError && <Alert severity="error" sx={{ mb: 2 }}>{tradingViewError}</Alert>}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="h6">{t('settings.tradingView.title')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settings.tradingView.body')}
                </Typography>
              </Stack>
              {tradingViewSettings?.hasSecret && (
                <Chip size="small" color={tradingViewSettings.enabled ? 'success' : 'default'} label={tradingViewSettings.enabled ? t('settings.tradingView.enabled') : t('settings.tradingView.disabled')} />
              )}
            </Stack>

            {tradingViewLoading ? (
              <Typography variant="body2" color="text.secondary">{t('settings.tradingView.loading')}</Typography>
            ) : (
              <>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={Boolean(tradingViewSettings?.enabled)}
                      onChange={(event) => handleTradingViewToggle(event.target.checked)}
                      disabled={tradingViewSaving}
                    />
                  )}
                  label={t('settings.tradingView.enable')}
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                  <Button variant="contained" onClick={handleTradingViewResetSecret} disabled={tradingViewSaving}>
                    {tradingViewSettings?.hasSecret ? t('settings.tradingView.resetSecret') : t('settings.tradingView.generateSecret')}
                  </Button>
                  {tradingViewSettings?.secretHint && (
                    <Chip variant="outlined" label={t('settings.tradingView.secretHint', { hint: tradingViewSettings.secretHint })} />
                  )}
                </Stack>

                {newTradingViewSecret && (
                  <TextField
                    label={t('settings.tradingView.newSecret')}
                    value={newTradingViewSecret}
                    fullWidth
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopyText(newTradingViewSecret)}>
                            {t('settings.tradingView.copy')}
                          </Button>
                        </InputAdornment>
                      )
                    }}
                    helperText={t('settings.tradingView.secretHelp')}
                  />
                )}

                <TextField
                  label={t('settings.tradingView.openUrl')}
                  value={tradingViewSettings?.openSignalWebhookUrl || ''}
                  fullWidth
                  multiline
                  minRows={2}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label={t('settings.tradingView.closeUrl')}
                  value={tradingViewSettings?.closeSignalWebhookUrl || ''}
                  fullWidth
                  multiline
                  minRows={2}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label={t('settings.tradingView.openPayload')}
                  value={tradingViewSettings?.sampleOpenPayload || ''}
                  fullWidth
                  multiline
                  minRows={8}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label={t('settings.tradingView.closePayload')}
                  value={tradingViewSettings?.sampleClosePayload || ''}
                  fullWidth
                  multiline
                  minRows={6}
                  InputProps={{ readOnly: true }}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardContent>
            <Stack spacing={2} maxWidth={720}>
              <Stack spacing={0.5}>
                <Typography variant="h6">{t('settings.chartStudies.title')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settings.chartStudies.body')}
                </Typography>
              </Stack>
              {chartSettingsMessage && <Alert severity="success">{chartSettingsMessage}</Alert>}
              {chartSettingsError && <Alert severity="error">{chartSettingsError}</Alert>}
              {chartSettingsLoading ? (
                <Typography variant="body2" color="text.secondary">{t('settings.chartStudies.loading')}</Typography>
              ) : (
                <>
                  <TextField
                    label={t('settings.chartStudies.label')}
                    value={chartIndicatorsDraft}
                    onChange={(event) => setChartIndicatorsDraft(event.target.value)}
                    fullWidth
                    multiline
                    minRows={6}
                    helperText={t('settings.chartStudies.help')}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Button variant="contained" onClick={() => void handleSaveChartSettings()} disabled={chartSettingsSaving}>
                      {chartSettingsSaving ? t('settings.chartStudies.saving') : t('settings.chartStudies.save')}
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      {t('settings.chartStudies.note')}
                    </Typography>
                  </Stack>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Stack spacing={1.5} maxWidth={680}>
            <Typography variant="h6">{t('settings.providers.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.providers.subtitle')}
            </Typography>
            {providerMessage && <Alert severity="success">{providerMessage}</Alert>}
            {providerError && <Alert severity="error">{providerError}</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} flexWrap="wrap">
              <Typography variant="body2">{t('settings.providers.oandaPractice')}</Typography>
              <Chip
                size="small"
                color={providerStatus?.connected ? 'success' : 'default'}
                label={providerStatus?.connected ? t('settings.providers.status.connected') : t('settings.providers.status.notConnected')}
              />
              {providerStatus?.accountId && (
                <Typography variant="caption" color="text.secondary">
                  {t('settings.providers.accountId')}: {providerStatus.accountId}
                </Typography>
              )}
            </Stack>

            <TextField
              type="password"
              label={t('settings.providers.token')}
              value={oandaTokenDraft}
              onChange={(event) => setOandaTokenDraft(event.target.value)}
              helperText={t('settings.providers.tokenHint')}
              placeholder="xxxxxxxxxxxxxxxxxxxx"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
              <Button variant="outlined" onClick={() => void handleTestProvider()} disabled={providerTesting || providerSaving || providerLoading}>
                {providerTesting ? t('settings.providers.actions.testing') : t('settings.providers.actions.test')}
              </Button>
              <Button variant="contained" onClick={() => void handleSaveProvider()} disabled={providerSaving || providerLoading}>
                {providerSaving ? t('settings.providers.actions.connecting') : t('settings.providers.actions.connect')}
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => void handleDisconnectProvider()}
                disabled={providerDisconnecting || providerLoading || !providerStatus?.connected}
              >
                {providerDisconnecting ? t('settings.providers.actions.disconnecting') : t('settings.providers.actions.disconnect')}
              </Button>
            </Stack>
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
