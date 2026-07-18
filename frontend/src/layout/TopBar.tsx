import { useMemo, useState } from 'react'
import MenuIcon from '@mui/icons-material/Menu'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
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
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Link } from 'react-router-dom'
import type { AppLanguage } from '../i18n'
import type { AuthUser } from '../api/auth'
import type { DashboardQueryState, DashboardStatusFilter } from '../features/dashboard/queryState'
import { useI18n } from '../i18n'
import type { ThemePreference } from '../themeMode'
import NotificationBell from '../components/layout/NotificationBell'

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
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isDashboardMobile = isDashboard && isNarrow

  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null)
  const [themeAnchor, setThemeAnchor] = useState<null | HTMLElement>(null)
  const [mobileActionsAnchor, setMobileActionsAnchor] = useState<null | HTMLElement>(null)
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)

  const profileOpen = Boolean(profileAnchor)
  const themeOpen = Boolean(themeAnchor)
  const mobileActionsOpen = Boolean(mobileActionsAnchor)
  const timezone = user?.timezone || 'Europe/Bucharest'
  const currency = user?.baseCurrency || 'USD'

  const getThemeLabel = (value: ThemePreference) => {
    if (value === 'light') return t('theme.light')
    if (value === 'dark') return t('theme.dark')
    if (value === 'black-shiny') return t('theme.blackShiny')
    return t('theme.system')
  }

  const getThemeIcon = (value: ThemePreference) => {
    if (value === 'light') return <LightModeOutlinedIcon fontSize="small" />
    if (value === 'dark') return <DarkModeOutlinedIcon fontSize="small" />
    if (value === 'black-shiny') return <AutoAwesomeRoundedIcon fontSize="small" />
    return <SettingsBrightnessOutlinedIcon fontSize="small" />
  }

  const statusValue = dashboardState.status
  const marketValue = dashboardState.market

  const dashboardFilters = useMemo(() => (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', lg: 'center' }}
      sx={{ width: '100%' }}
    >
      <TextField
        size="small"
        type="date"
        label={t('dashboard.topBar.from')}
        value={dashboardState.from}
        onChange={(event) => onDashboardStateChange({ from: event.target.value })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: { xs: '100%', md: 145 } }}
        inputProps={{ 'aria-label': t('dashboard.topBar.from') }}
      />
      <TextField
        size="small"
        type="date"
        label={t('dashboard.topBar.to')}
        value={dashboardState.to}
        onChange={(event) => onDashboardStateChange({ to: event.target.value })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: { xs: '100%', md: 145 } }}
        inputProps={{ 'aria-label': t('dashboard.topBar.to') }}
      />
      <Tooltip title={t('dashboard.topBar.comingSoon')} arrow>
        <span>
          <TextField
            size="small"
            label={t('dashboard.topBar.account')}
            value={dashboardState.accountId}
            disabled
            sx={{ minWidth: { xs: '100%', md: 140 } }}
            inputProps={{ 'aria-label': t('dashboard.topBar.account') }}
          />
        </span>
      </Tooltip>
      <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 155 } }}>
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
      <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 145 } }}>
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
        sx={{ minHeight: 40 }}
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

  const languageControl = (
    <ToggleButtonGroup
      size="small"
      value={language}
      exclusive
      aria-label={t('language.label')}
      onChange={(_, next) => {
        if (next) {
          onLanguageChange(next)
        }
      }}
      sx={{
        '& .MuiToggleButton-root': {
          borderColor: 'divider',
          minWidth: 42,
          height: 34,
          px: 1,
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase'
        }
      }}
    >
      <ToggleButton value="en" aria-label={t('language.english')}>EN</ToggleButton>
      <ToggleButton value="ro" aria-label={t('language.romanian')}>RO</ToggleButton>
    </ToggleButtonGroup>
  )

  const themeMenu = (
    <Menu
      anchorEl={themeAnchor}
      open={themeOpen}
      onClose={() => setThemeAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {(['system', 'light', 'dark', 'black-shiny'] as ThemePreference[]).map((item) => (
        <MenuItem
          key={item}
          selected={themePreference === item}
          onClick={() => {
            onThemePreferenceChange(item)
            setThemeAnchor(null)
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {getThemeIcon(item)}
            <Typography variant="body2">{getThemeLabel(item)}</Typography>
          </Stack>
        </MenuItem>
      ))}
    </Menu>
  )

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar
          sx={{
            py: 1,
            minHeight: isDashboard ? { xs: 74, md: 86 } : { xs: 68, md: 74 },
            alignItems: 'flex-start',
            overflowX: 'clip',
            minWidth: 0
          }}
        >
          <Stack spacing={1.25} sx={{ width: '100%', minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ minWidth: 0 }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                {showMenuToggle && (
                  <IconButton onClick={onMenuToggle} aria-label={t('nav.openMenu')} sx={{ width: 40, height: 40 }}>
                    <MenuIcon />
                  </IconButton>
                )}

                {showTitle && !isNarrow && (
                  <Stack sx={{ minWidth: 0, pl: showMenuToggle ? 0.5 : 0 }}>
                    <Typography component="h1" variant="subtitle1" noWrap sx={{ fontSize: { xs: '0.9rem', md: '0.98rem' } }}>
                      {title}
                    </Typography>
                    {subtitle && !isNarrow && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {subtitle}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>

              {isAuthenticated ? (
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                  <NotificationBell />
                  {!isNarrow && (
                    <>
                      <Chip label={currency} size="small" variant="outlined" aria-label={t('dashboard.topBar.currency')} />
                      <Chip label={timezone} size="small" variant="outlined" aria-label={t('dashboard.topBar.timezone')} />
                      {languageControl}
                    </>
                  )}

                  <Tooltip title={t('theme.label')}>
                    <IconButton
                      aria-label={t('theme.label')}
                      onClick={(event) => setThemeAnchor(event.currentTarget)}
                      sx={{ width: 38, height: 38 }}
                    >
                      {getThemeIcon(themePreference)}
                    </IconButton>
                  </Tooltip>

                  {isNarrow && (
                    <IconButton
                      aria-label={t('nav.settings')}
                      onClick={(event) => setMobileActionsAnchor(event.currentTarget)}
                      sx={{ width: 38, height: 38 }}
                    >
                      <MoreVertRoundedIcon />
                    </IconButton>
                  )}

                  <IconButton
                    aria-label={t('nav.profile')}
                    onClick={(event) => setProfileAnchor(event.currentTarget)}
                    sx={{ width: 40, height: 40 }}
                  >
                    <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
                      {(user?.email || 'U')[0].toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" spacing={1}>
                  {!isXs && languageControl}
                  <Tooltip title={t('theme.label')}>
                    <IconButton
                      aria-label={t('theme.label')}
                      onClick={(event) => setThemeAnchor(event.currentTarget)}
                      sx={{ width: 38, height: 38 }}
                    >
                      {getThemeIcon(themePreference)}
                    </IconButton>
                  </Tooltip>
                  <Button color="inherit" component={Link} to="/login">{t('nav.login')}</Button>
                  <Button variant="contained" component={Link} to="/register">{t('nav.register')}</Button>
                </Stack>
              )}
            </Stack>

            {showTitle && isNarrow && (
              <Box sx={{ px: 0.5, minWidth: 0 }}>
                <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 19, sm: 22 }, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                  {title}
                </Typography>
                {subtitle && (
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {subtitle}
                  </Typography>
                )}
              </Box>
            )}

            {isDashboard && !isDashboardMobile && (
              <Box
                sx={{
                  px: 1,
                  py: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper'
                }}
              >
                {dashboardFilters}
              </Box>
            )}

            {isDashboardMobile && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  px: 1,
                  py: 1
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    pr: 1,
                    overflow: 'hidden'
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.topBar.activeFilters')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {dashboardFilterSummary}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<FilterListRoundedIcon />}
                  onClick={() => setDashboardFiltersOpen(true)}
                  aria-label={t('dashboard.topBar.filters')}
                  sx={{ minHeight: 40, flexShrink: 0 }}
                >
                  {t('dashboard.topBar.filters')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Toolbar>
        <Box
          sx={{
            height: '1px',
            background: (theme) => `linear-gradient(90deg, transparent 0%, ${theme.palette.primary.main} 45%, ${theme.palette.secondary.main} 100%)`,
            opacity: 0.6,
            pointerEvents: 'none'
          }}
        />
      </AppBar>

      {themeMenu}

      <Menu
        anchorEl={mobileActionsAnchor}
        open={mobileActionsOpen}
        onClose={() => setMobileActionsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>{currency}</MenuItem>
        <MenuItem disabled>{timezone}</MenuItem>
        <MenuItem
          onClick={() => {
            onLanguageChange(language === 'en' ? 'ro' : 'en')
            setMobileActionsAnchor(null)
          }}
        >
          {language === 'en' ? t('language.romanian') : t('language.english')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMobileActionsAnchor(null)
            setThemeAnchor(mobileActionsAnchor)
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <PaletteOutlinedIcon fontSize="small" />
            <Typography variant="body2">{t('theme.label')}</Typography>
          </Stack>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={profileAnchor}
        open={profileOpen}
        onClose={() => setProfileAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {user?.email && (
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
              {user.email}
            </Typography>
          </MenuItem>
        )}
        <MenuItem component={Link} to="/profile" onClick={() => setProfileAnchor(null)}>
          {t('nav.profile')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setProfileAnchor(null)
            onLogout()
          }}
        >
          {t('nav.logout')}
        </MenuItem>
      </Menu>

      {dashboardFiltersOpen && (
        <Drawer
          anchor="bottom"
          open
          onClose={() => setDashboardFiltersOpen(false)}
          transitionDuration={{ enter: 180, exit: 0 }}
          ModalProps={{ keepMounted: false }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: '100%',
              maxWidth: '100vw',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
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
                sx={{ width: 40, height: 40 }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            {dashboardFilters}
          </Stack>
        </Drawer>
      )}
    </>
  )
}
