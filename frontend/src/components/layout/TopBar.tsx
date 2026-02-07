import { useMemo, useState } from 'react'
import MenuIcon from '@mui/icons-material/Menu'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
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

const MARKET_OPTIONS = ['STOCK', 'CFD', 'FOREX', 'CRYPTO', 'FUTURES', 'OPTIONS', 'OTHER'] as const

type TopBarProps = {
  title: string
  subtitle?: string
  isAuthenticated: boolean
  showMenuToggle: boolean
  onMenuToggle: () => void
  user: AuthUser | null
  language: AppLanguage
  onLanguageChange: (language: AppLanguage) => void
  isDashboard: boolean
  dashboardState: DashboardQueryState
  onDashboardStateChange: (patch: Partial<DashboardQueryState>) => void
  onOpenDefinitions: () => void
  onLogout: () => void
}

export default function TopBar({
  title,
  subtitle,
  isAuthenticated,
  showMenuToggle,
  onMenuToggle,
  user,
  language,
  onLanguageChange,
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

  const timezone = user?.timezone || 'Europe/Bucharest'
  const currency = user?.baseCurrency || 'USD'

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
        sx={{ minHeight: 40 }}
      >
        {t('dashboard.definitions.open')}
      </Button>
    </Stack>
  ), [dashboardState.accountId, dashboardState.from, dashboardState.to, marketValue, onDashboardStateChange, onOpenDefinitions, statusValue, t])

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar
        sx={{
          minHeight: { xs: isDashboard ? 92 : 72, md: isDashboard ? 132 : 72 },
          py: isDashboard ? 1.5 : 1,
          alignItems: 'flex-start'
        }}
      >
        <Stack spacing={1.5} sx={{ width: '100%' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              {showMenuToggle && (
                <IconButton onClick={onMenuToggle} aria-label={t('nav.openMenu')} sx={{ width: 40, height: 40 }}>
                  <MenuIcon />
                </IconButton>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h1" sx={{ lineHeight: 1.2, fontSize: { xs: 20, sm: 24 } }} noWrap>
                  {title}
                </Typography>
                {subtitle && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }} noWrap>
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Stack>

            {isAuthenticated ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}
                flexWrap={{ xs: 'wrap', sm: 'nowrap' }}
                sx={{ width: { xs: '100%', sm: 'auto' }, rowGap: 1 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', lg: 'block' }, maxWidth: 220 }}
                  noWrap
                >
                  {user?.email || ''}
                </Typography>
                {!isNarrow && (
                  <>
                    <Chip label={currency} size="small" variant="outlined" aria-label={t('dashboard.topBar.currency')} />
                    <Chip label={timezone} size="small" variant="outlined" aria-label={t('dashboard.topBar.timezone')} />
                  </>
                )}
                <FormControl size="small" sx={{ minWidth: { xs: 88, sm: 110 } }}>
                  <Select
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value as AppLanguage)}
                    inputProps={{ 'aria-label': t('language.label') }}
                  >
                    <MenuItem value="en">{t('language.english')}</MenuItem>
                    <MenuItem value="ro">{t('language.romanian')}</MenuItem>
                  </Select>
                </FormControl>
                <IconButton
                  aria-label={t('nav.profile')}
                  onClick={(event) => setProfileAnchor(event.currentTarget)}
                  sx={{ width: 40, height: 40 }}
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
                      <Typography variant="caption" color="text.secondary" noWrap>{user.email}</Typography>
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
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}
                flexWrap={{ xs: 'wrap', sm: 'nowrap' }}
                sx={{ width: { xs: '100%', sm: 'auto' }, rowGap: 1 }}
              >
                <FormControl size="small" sx={{ minWidth: { xs: 88, sm: 112 } }}>
                  <Select
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value as AppLanguage)}
                    inputProps={{ 'aria-label': t('language.label') }}
                  >
                    <MenuItem value="en">{t('language.english')}</MenuItem>
                    <MenuItem value="ro">{t('language.romanian')}</MenuItem>
                  </Select>
                </FormControl>
                <Button color="inherit" component={Link} to="/login" sx={{ minHeight: 40 }}>{t('nav.login')}</Button>
                <Button variant="contained" component={Link} to="/register" sx={{ minHeight: 40 }}>{t('nav.register')}</Button>
              </Stack>
            )}
          </Stack>
          {isDashboard && dashboardFilters}
        </Stack>
      </Toolbar>
    </AppBar>
  )
}
