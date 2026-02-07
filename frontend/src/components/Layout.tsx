import {
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  ListSubheader,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import TableChartIcon from '@mui/icons-material/TableChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import NoteIcon from '@mui/icons-material/Note'
import InsightsIcon from '@mui/icons-material/Insights'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SettingsIcon from '@mui/icons-material/Settings'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import TopBar from './layout/TopBar'
import DefinitionsDrawer from './dashboard/DefinitionsDrawer'
import { buildDashboardSearchParams, DashboardQueryState, readDashboardQueryState } from '../features/dashboard/queryState'

const SIDEBAR_WIDTH = 272
const SIDEBAR_COLLAPSED_WIDTH = 88
const SIDEBAR_STORAGE_KEY = 'layout.sidebarCollapsed'

type NavItem = {
  label: string
  path: string
  icon: ReactNode
}

type NavSection = {
  key: 'trading' | 'journal' | 'system'
  label: string
  items: NavItem[]
}

export default function Layout() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [definitionsOpen, setDefinitionsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const persisted = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return persisted === 'true'
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navSections = useMemo<NavSection[]>(() => {
    const tradingItems: NavItem[] = [
      { label: t('nav.dashboard'), path: '/dashboard', icon: <DashboardIcon /> },
      { label: t('nav.trades'), path: '/trades', icon: <TableChartIcon /> },
      { label: t('nav.calendar'), path: '/calendar', icon: <CalendarMonthIcon /> },
    ]

    const journalItems: NavItem[] = [
      { label: t('nav.notebook'), path: '/notebook', icon: <NoteIcon /> },
      { label: t('nav.insights'), path: '/insights', icon: <MenuBookIcon /> },
      { label: t('nav.analytics'), path: '/analytics', icon: <InsightsIcon /> },
    ]

    const systemItems: NavItem[] = [
      { label: t('nav.settings'), path: '/settings', icon: <SettingsIcon /> }
    ]

    if (user?.role === 'ADMIN') {
      systemItems.push({ label: t('nav.admin'), path: '/admin/content', icon: <AdminPanelSettingsIcon /> })
    }

    return [
      { key: 'trading', label: t('navGroups.trading'), items: tradingItems },
      { key: 'journal', label: t('navGroups.journal'), items: journalItems },
      { key: 'system', label: t('navGroups.system'), items: systemItems }
    ]
  }, [t, user?.role])

  const allNavItems = useMemo(() => navSections.flatMap((section) => section.items), [navSections])

  const pageMeta = useMemo(() => {
    const fallback = { title: t('app.name'), subtitle: '' }

    if (location.pathname.startsWith('/profile')) {
      return { title: t('nav.profile'), subtitle: '' }
    }
    if (location.pathname.startsWith('/dashboard')) {
      return { title: t('dashboard.title'), subtitle: t('dashboard.subtitle') }
    }
    if (location.pathname.startsWith('/trades')) {
      return { title: t('trades.title'), subtitle: t('trades.subtitle') }
    }
    if (location.pathname.startsWith('/calendar')) {
      return { title: t('calendar.title'), subtitle: t('calendar.subtitle') }
    }
    if (location.pathname.startsWith('/notebook')) {
      return { title: t('notebook.title'), subtitle: t('notebook.subtitle') }
    }
    if (location.pathname.startsWith('/analytics')) {
      return { title: t('analytics.title'), subtitle: t('analytics.subtitle') }
    }
    if (location.pathname.startsWith('/insights')) {
      return { title: t('insights.title'), subtitle: t('insights.subtitle') }
    }
    if (location.pathname.startsWith('/settings')) {
      return { title: t('settings.title'), subtitle: t('settings.subtitle') }
    }
    if (location.pathname.startsWith('/admin/content')) {
      return { title: t('adminContent.title'), subtitle: t('adminContent.subtitle') }
    }

    const match = allNavItems.find((item) => location.pathname.startsWith(item.path))
    if (!match) return fallback
    return { title: match.label, subtitle: '' }
  }, [allNavItems, location.pathname, t])

  const isDashboard = location.pathname.startsWith('/dashboard')
  const dashboardState = useMemo(() => readDashboardQueryState(searchParams), [searchParams.toString()])

  const updateDashboardState = useCallback((patch: Partial<DashboardQueryState>) => {
    const nextState: DashboardQueryState = { ...dashboardState, ...patch }
    const nextParams = buildDashboardSearchParams(nextState, searchParams)
    setSearchParams(nextParams)
  }, [dashboardState, searchParams, setSearchParams])

  useEffect(() => {
    if (!isDashboard) return
    const next = buildDashboardSearchParams(dashboardState, searchParams)
    if (next.toString() === searchParams.toString()) return
    setSearchParams(next, { replace: true })
  }, [dashboardState, isDashboard, searchParams, setSearchParams])

  useEffect(() => {
    document.title = pageMeta.title === t('app.name')
      ? t('app.name')
      : `${pageMeta.title} | ${t('app.name')}`
  }, [pageMeta.title, t])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!isDashboard) {
      setDefinitionsOpen(false)
    }
  }, [isDashboard])

  const desktopCollapsed = isMobile ? false : sidebarCollapsed
  const effectiveSidebarWidth = desktopCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  const drawer = (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'common.white' }} noWrap>
            {desktopCollapsed ? 'TJ' : t('app.name')}
          </Typography>
          {!desktopCollapsed && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {t('app.tagline')}
            </Typography>
          )}
        </Box>
        {!isMobile && (
          <Tooltip title={desktopCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')} arrow>
            <IconButton
              size="small"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={desktopCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
            >
              {desktopCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />
      <List sx={{ px: 1, pt: 1.5, flexGrow: 1 }}>
        {navSections.map((section) => (
          <Box key={section.key} sx={{ mb: 1 }}>
            {!desktopCollapsed && (
              <ListSubheader
                disableSticky
                sx={{
                  backgroundColor: 'transparent',
                  color: 'text.secondary',
                  fontSize: 11,
                  lineHeight: 1.6,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  px: 1.5
                }}
              >
                {section.label}
              </ListSubheader>
            )}
            {section.items.map((item) => {
              const button = (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  selected={location.pathname.startsWith(item.path)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    px: desktopCollapsed ? 1.25 : 1.5,
                    justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                    color: 'inherit',
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      color: 'common.white',
                      '& .MuiListItemIcon-root': {
                        color: 'common.white'
                      }
                    },
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: desktopCollapsed ? 'auto' : 34 }}>
                    {item.icon}
                  </ListItemIcon>
                  {!desktopCollapsed && (
                    <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true }} sx={{ minWidth: 0 }} />
                  )}
                </ListItemButton>
              )

              if (desktopCollapsed) {
                return (
                  <Tooltip key={item.path} title={item.label} placement="right" arrow>
                    {button}
                  </Tooltip>
                )
              }

              return button
            })}
          </Box>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ px: desktopCollapsed ? 1 : 2, pb: 2 }}>
        <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)', mb: 1.5 }} />
        <Tooltip title={user?.email || ''} arrow disableHoverListener={!desktopCollapsed}>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', textAlign: desktopCollapsed ? 'center' : 'left' }}>
            {desktopCollapsed ? (user?.email || '…')[0].toUpperCase() : user?.email}
          </Typography>
        </Tooltip>
      </Box>
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isAuthenticated && (
        <Box component="nav" sx={{ width: { md: effectiveSidebarWidth }, flexShrink: { md: 0 } }}>
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: isMobile ? SIDEBAR_WIDTH : effectiveSidebarWidth,
                transition: theme.transitions.create('width', {
                  duration: theme.transitions.duration.shorter,
                  easing: theme.transitions.easing.easeInOut
                })
              }
            }}
          >
            {drawer}
          </Drawer>
        </Box>
      )}
        <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh'
        }}
      >
        <TopBar
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          isAuthenticated={isAuthenticated}
          showMenuToggle={isAuthenticated && isMobile}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
          user={user}
          language={language}
          onLanguageChange={(value) => setLanguage(value)}
          isDashboard={isDashboard}
          dashboardState={dashboardState}
          onDashboardStateChange={updateDashboardState}
          onOpenDefinitions={() => setDefinitionsOpen(true)}
          onLogout={handleLogout}
        />
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 1.5, md: 3 },
            px: { xs: 1.5, sm: 2.5, md: 3 },
            flexGrow: 1,
            width: '100%'
          }}
        >
          <Outlet />
        </Container>
        <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider', py: 2, width: '100%' }}>
          <Container maxWidth="xl">
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Typography variant="caption" color="text.secondary">
                {t('app.disclaimer')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Button component={Link} to="/terms" size="small">{t('footer.terms')}</Button>
                <Button component={Link} to="/privacy" size="small">{t('footer.privacy')}</Button>
                <Button component={Link} to="/cookies" size="small">{t('footer.cookies')}</Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
      <DefinitionsDrawer
        open={definitionsOpen}
        onClose={() => setDefinitionsOpen(false)}
      />
    </Box>
  )
}
