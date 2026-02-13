import { useMemo, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import FilterListIcon from '@mui/icons-material/FilterList'
import MenuIcon from '@mui/icons-material/Menu'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Link } from 'react-router-dom'
import type { AppLanguage } from '../../i18n'
import type { AuthUser } from '../../api/auth'
import type { DashboardQueryState, DashboardStatusFilter } from '../../features/dashboard/queryState'
import { useI18n } from '../../i18n'
import type { ThemePreference } from '../../themeMode'
import NotificationBell from './NotificationBell'

const MARKET_OPTIONS = ['STOCK', 'CFD', 'FOREX', 'CRYPTO', 'FUTURES', 'OPTIONS', 'OTHER'] as const

type TopBarProps = {
  title: string
  subtitle?: string
  showTitle?: boolean
  isAuthenticated: boolean
  showMenuToggle: boolean
  onMenuToggle: () => void
  user: AuthUser | null
  language: AppLanguage
  onLanguageChange: (language: AppLanguage) => void
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
  isDashboard: boolean
  dashboardState: DashboardQueryState
  onDashboardStateChange: (patch: Partial<DashboardQueryState>) => void
  onOpenDefinitions: () => void
  onLogout: () => void
}

export default function TopBar({
  title,
  subtitle,
  showTitle = true,
  isAuthenticated,
  showMenuToggle,
  onMenuToggle,
  user,
  language,
  onLanguageChange,
  themePreference,
  onThemePreferenceChange,
  isDashboard,
  dashboardState,
  onDashboardStateChange,
  onOpenDefinitions,
  onLogout
}: TopBarProps) {
  const { t } = useI18n()
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null)
  const profileOpen = Boolean(profileAnchor)
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))
  const isDashboardMobile = isDashboard && isNarrow
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)

  const timezone = user?.timezone || 'Europe/Bucharest'
  const currency = user?.baseCurrency || 'USD'

  const getThemeLabel = (value: ThemePreference) => {
    if (value === 'light') return t('theme.light')
    if (value === 'dark') return t('theme.dark')
    return t('theme.system')
  }

  const getThemeIcon = (value: ThemePreference) => {
    if (value === 'light') return <LightModeOutlinedIcon fontSize="small" />
    if (value === 'dark') return <DarkModeOutlinedIcon fontSize="small" />
    return <SettingsBrightnessOutlinedIcon fontSize="small" />
  }

  const themeSelector = (
    <FormControl size="small" sx={{ minWidth: isXs ? 56 : 132, flexShrink: 0 }}>
      <Select
        value={themePreference}
        onChange={(event) => onThemePreferenceChange(event.target.value as ThemePreference)}
        inputProps={{ 'aria-label': t('theme.label') }}
        sx={{ minHeight: 44 }}
        renderValue={(value) => (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            {getThemeIcon(value as ThemePreference)}
            {!isCompact && (
              <Typography variant="body2" noWrap>
                {getThemeLabel(value as ThemePreference)}
              </Typography>
            )}
          </Stack>
        )}
      >
        <MenuItem value="system">
          <Stack direction="row" spacing={1} alignItems="center">
            <SettingsBrightnessOutlinedIcon fontSize="small" />
            <Typography variant="body2">{t('theme.system')}</Typography>
          </Stack>
        </MenuItem>
        <MenuItem value="light">
          <Stack direction="row" spacing={1} alignItems="center">
            <LightModeOutlinedIcon fontSize="small" />
            <Typography variant="body2">{t('theme.light')}</Typography>
          </Stack>
        </MenuItem>
        <MenuItem value="dark">
          <Stack direction="row" spacing={1} alignItems="center">
            <DarkModeOutlinedIcon fontSize="small" />
            <Typography variant="body2">{t('theme.dark')}</Typography>
          </Stack>
        </MenuItem>
      </Select>
    </FormControl>
  )

  const statusValue = dashboardState.status
  const marketValue = dashboardState.market
  const dashboardFilters = useMemo(() => (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', lg: 'center' }}
      flexWrap="wrap"
      sx={{ width: { xs: '100%', lg: 'auto' } }}
    >
      <TextField
        size="small"
        type="date"
        label={t('dashboard.topBar.from')}
        value={dashboardState.from}
        onChange={(event) => onDashboardStateChange({ from: event.target.value })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: { xs: '100%', sm: 145 } }}
        inputProps={{ 'aria-label': t('dashboard.topBar.from') }}
      />
      <TextField
        size="small"
        type="date"
        label={t('dashboard.topBar.to')}
        value={dashboardState.to}
        onChange={(event) => onDashboardStateChange({ to: event.target.value })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: { xs: '100%', sm: 145 } }}
        inputProps={{ 'aria-label': t('dashboard.topBar.to') }}
      />
      <Tooltip title={t('dashboard.topBar.comingSoon')} arrow>
        <span>
          <TextField
            size="small"
            label={t('dashboard.topBar.account')}
            value={dashboardState.accountId}
            disabled
            sx={{ minWidth: { xs: '100%', sm: 140 } }}
            inputProps={{ 'aria-label': t('dashboard.topBar.account') }}
          />
        </span>
      </Tooltip>
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
        <InputLabel id="dashboard-market-label">{t('dashboard.topBar.market')}</InputLabel>
        <Select
          labelId="dashboard-market-label"
          label={t('dashboard.topBar.market')}
          value={marketValue}
          onChange={(event) => onDashboardStateChange({ market: event.target.value })}
          inputProps={{ 'aria-label': t('dashboard.topBar.market') }}
        >
          <MenuItem value="">{t('trades.filters.any')}</MenuItem>
          {MARKET_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 145 } }}>
        <InputLabel id="dashboard-status-label">{t('dashboard.topBar.status')}</InputLabel>
        <Select
          labelId="dashboard-status-label"
          label={t('dashboard.topBar.status')}
          value={statusValue}
          onChange={(event) => onDashboardStateChange({ status: event.target.value as DashboardStatusFilter })}
          inputProps={{ 'aria-label': t('dashboard.topBar.status') }}
        >
          <MenuItem value="ALL">{t('trades.filters.any')}</MenuItem>
          <MenuItem value="CLOSED">{t('trades.status.CLOSED')}</MenuItem>
          <MenuItem value="OPEN">{t('trades.status.OPEN')}</MenuItem>
        </Select>
      </FormControl>
      <Button
        variant="outlined"
        startIcon={<InfoOutlinedIcon />}
        onClick={onOpenDefinitions}
        aria-label={t('dashboard.definitions.open')}
        sx={{ minHeight: 44 }}
      >
        {t('dashboard.definitions.open')}
      </Button>
    </Stack>
  ), [dashboardState.accountId, dashboardState.from, dashboardState.to, marketValue, onDashboardStateChange, onOpenDefinitions, statusValue, t])
  const dashboardFilterSummary = useMemo(() => {
    const statusLabel = statusValue === 'ALL' ? t('trades.filters.any') : t(`trades.status.${statusValue}`)
    const summaryParts = [
      `${dashboardState.from} - ${dashboardState.to}`,
      `${t('dashboard.topBar.status')}: ${statusLabel}`
    ]
    if (marketValue) {
      summaryParts.push(`${t('dashboard.topBar.market')}: ${marketValue}`)
    }
    return summaryParts.join(' | ')
  }, [dashboardState.from, dashboardState.to, marketValue, statusValue, t])

  return (
    <>
      <AppBar position="sticky" elevation={0}>
      <Toolbar
        sx={{
          minHeight: { xs: isDashboard ? (isDashboardMobile ? 102 : 92) : 64, md: isDashboard ? 132 : 72 },
          py: isDashboard ? (isDashboardMobile ? 1 : 1.5) : 1,
          alignItems: 'flex-start',
          overflowX: 'clip',
          minWidth: 0
        }}
      >
        <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{
              minWidth: 0,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              rowGap: 1
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flexGrow: 1 }}>
              {showMenuToggle && (
                <IconButton onClick={onMenuToggle} aria-label={t('nav.openMenu')} sx={{ width: 44, height: 44 }}>
                  <MenuIcon />
                </IconButton>
              )}
              {showTitle ? (
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="h1" sx={{ lineHeight: 1.2, fontSize: { xs: 20, sm: 24 } }} noWrap>
                    {title}
                  </Typography>
                  {subtitle && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: { xs: 'none', sm: 'block' },
                        maxWidth: '68ch',
                        overflowWrap: 'anywhere',
                        minWidth: 0
                      }}
                    >
                      {subtitle}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box sx={{ minWidth: 0, width: 0, height: 40 }} />
              )}
            </Stack>

            {isAuthenticated ? (
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{
                    maxWidth: '100%',
                    flexShrink: 0,
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: { sm: 180, md: 220 }, minWidth: 0 }}
                    noWrap
                  >
                    {user?.email || ''}
                  </Typography>
                  {themeSelector}
                  <NotificationBell />
                  {!isNarrow && (
                  <>
                    <Chip label={currency} size="small" variant="outlined" aria-label={t('dashboard.topBar.currency')} />
                    <Chip label={timezone} size="small" variant="outlined" aria-label={t('dashboard.topBar.timezone')} />
                  </>
                )}
                <FormControl size="small" sx={{ minWidth: isXs ? 68 : 110, flexShrink: 0 }}>
                  <Select
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value as AppLanguage)}
                    inputProps={{ 'aria-label': t('language.label') }}
                    sx={{ minHeight: 44 }}
                    renderValue={(value) => (isCompact ? String(value).toUpperCase() : t(value === 'en' ? 'language.english' : 'language.romanian'))}
                  >
                    <MenuItem value="en">{t('language.english')}</MenuItem>
                    <MenuItem value="ro">{t('language.romanian')}</MenuItem>
                  </Select>
                </FormControl>
                <IconButton
                  aria-label={t('nav.profile')}
                  onClick={(event) => setProfileAnchor(event.currentTarget)}
                  sx={{ width: 44, height: 44 }}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    {(user?.email || 'U')[0].toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={profileAnchor}
                  open={profileOpen}
                  onClose={() => setProfileAnchor(null)}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {isNarrow && (
                    <MenuItem disabled>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{currency}</Typography>
                        <Typography variant="caption" color="text.secondary">{timezone}</Typography>
                      </Stack>
                    </MenuItem>
                  )}
                  {user?.email && (
                    <MenuItem disabled sx={{ display: { xs: 'flex', lg: 'none' } }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {user.email}
                      </Typography>
                    </MenuItem>
                  )}
                  <MenuItem component={Link} to="/profile" onClick={() => setProfileAnchor(null)}>
                    {t('nav.profile')}
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setProfileAnchor(null)
                    onLogout()
                  }}>
                    {t('nav.logout')}
                  </MenuItem>
                </Menu>
              </Stack>
            ) : (
                <Stack
                  direction="row"
                  spacing={0.75}
                alignItems="center"
                sx={{
                  maxWidth: '100%',
                  flexShrink: 0,
                  minWidth: 0,
                  overflow: 'hidden'
                }}
                >
                {themeSelector}
                <FormControl size="small" sx={{ minWidth: isXs ? 68 : 112, flexShrink: 0 }}>
                  <Select
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value as AppLanguage)}
                    inputProps={{ 'aria-label': t('language.label') }}
                    sx={{ minHeight: 44 }}
                    renderValue={(value) => (isCompact ? String(value).toUpperCase() : t(value === 'en' ? 'language.english' : 'language.romanian'))}
                  >
                    <MenuItem value="en">{t('language.english')}</MenuItem>
                    <MenuItem value="ro">{t('language.romanian')}</MenuItem>
                  </Select>
                </FormControl>
                <Button color="inherit" component={Link} to="/login" sx={{ minHeight: 44 }}>{t('nav.login')}</Button>
                <Button variant="contained" component={Link} to="/register" sx={{ minHeight: 44 }}>{t('nav.register')}</Button>
              </Stack>
            )}
          </Stack>
          {isDashboard && !isDashboardMobile && dashboardFilters}
          {isDashboardMobile && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{
                p: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                minWidth: 0
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.topBar.activeFilters')}
                </Typography>
                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {dashboardFilterSummary}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<FilterListIcon />}
                onClick={() => setDashboardFiltersOpen(true)}
                aria-label={t('dashboard.topBar.filters')}
                sx={{ minHeight: 44, flexShrink: 0 }}
              >
                {t('dashboard.topBar.filters')}
              </Button>
            </Stack>
          )}
        </Stack>
      </Toolbar>
      </AppBar>
      <Drawer
        anchor="bottom"
        open={dashboardFiltersOpen}
        onClose={() => setDashboardFiltersOpen(false)}
        ModalProps={{ keepMounted: false }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: '100%',
            maxWidth: '100vw',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            px: 2,
            pt: 1.5,
            pb: 'calc(16px + env(safe-area-inset-bottom))',
            maxHeight: '85dvh',
            overflowY: 'auto'
          }
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">{t('dashboard.topBar.filters')}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {dashboardFilterSummary}
              </Typography>
            </Box>
            <IconButton
              onClick={() => setDashboardFiltersOpen(false)}
              aria-label={t('dashboard.topBar.closeFilters')}
              sx={{ width: 44, height: 44 }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          {dashboardFilters}
        </Stack>
      </Drawer>
    </>
  )
}
