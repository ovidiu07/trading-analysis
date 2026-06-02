import {
  Box,
  Button,
  Container,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import TroubleshootRoundedIcon from '@mui/icons-material/TroubleshootRounded'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import TopBar from './TopBar'
import SideNav, { SideNavSection } from './SideNav'
import DefinitionsDrawer from '../components/dashboard/DefinitionsDrawer'
import { buildDashboardSearchParams, DashboardQueryState, readDashboardQueryState } from '../features/dashboard/queryState'
import { resolveRouteMeta } from '../config/routeMeta'
import DemoDataBanner from '../components/demo/DemoDataBanner'
import { ThemePreference, toBackendThemePreference, useThemeMode } from '../themeMode'
import { isAdminUser } from '../auth/roles'

const SIDEBAR_WIDTH = 286
const SIDEBAR_COLLAPSED_WIDTH = 96
const SIDEBAR_STORAGE_KEY = 'layout.sidebarCollapsed'

export default function AppShell() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, updateSettings } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const { preference: themePreference, setPreference } = useThemeMode()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [definitionsOpen, setDefinitionsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleThemePreferenceChange = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference)
    if (!isAuthenticated || !user) {
      return
    }
    updateSettings({
      baseCurrency: user.baseCurrency || 'USD',
      timezone: user.timezone || 'UTC',
      themePreference: toBackendThemePreference(nextPreference)
    }).catch(() => {})
  }, [isAuthenticated, setPreference, updateSettings, user])

  const navSections = useMemo<SideNavSection[]>(() => {
    const tradingItems = [
      { label: t('nav.today'), path: '/today', icon: <TodayOutlinedIcon fontSize="small" /> },
      { label: t('nav.dashboard'), path: '/dashboard', icon: <SpaceDashboardRoundedIcon fontSize="small" /> },
      { label: t('nav.strategies'), path: '/strategies', icon: <AutoAwesomeMotionRoundedIcon fontSize="small" /> },
      { label: t('nav.backtesting'), path: '/backtesting', icon: <PhotoLibraryRoundedIcon fontSize="small" /> },
      { label: t('nav.insights'), path: '/insights', icon: <AutoStoriesOutlinedIcon fontSize="small" /> },
      { label: t('nav.analytics'), path: '/analytics', icon: <QueryStatsRoundedIcon fontSize="small" /> },
      { label: t('nav.diagnostics'), path: '/diagnostics', icon: <TroubleshootRoundedIcon fontSize="small" /> },
      { label: t('nav.calendar'), path: '/calendar', icon: <CalendarMonthRoundedIcon fontSize="small" /> },
    ]

    const journalItems = [
      { label: t('nav.trades'), path: '/trades', icon: <CandlestickChartRoundedIcon fontSize="small" /> },
      { label: t('nav.notebook'), path: '/notebook', icon: <MenuBookRoundedIcon fontSize="small" /> },
    ]

    const systemItems = [
      { label: t('nav.settings'), path: '/settings', icon: <SettingsRoundedIcon fontSize="small" /> }
    ]

    if (isAdminUser(user)) {
      systemItems.push({ label: t('nav.admin'), path: '/admin/content', icon: <AdminPanelSettingsRoundedIcon fontSize="small" /> })
    }

    return [
      { key: 'trading', label: t('navGroups.trading'), items: tradingItems },
      { key: 'journal', label: t('navGroups.journal'), items: journalItems },
      { key: 'system', label: t('navGroups.system'), items: systemItems }
    ]
  }, [t, user])

  const allNavItems = useMemo(() => navSections.flatMap((section) => section.items), [navSections])

  const pageMeta = useMemo(() => {
    const timezone = user?.timezone || 'Europe/Bucharest'
    const fromRouteMeta = resolveRouteMeta(location.pathname, t, { timezone })
    if (fromRouteMeta) {
      return {
        id: fromRouteMeta.id,
        title: fromRouteMeta.pageTitle,
        subtitle: fromRouteMeta.pageSubtitle,
        showHeader: fromRouteMeta.showHeader
      }
    }

    const navMatch = allNavItems.find((item) => location.pathname.startsWith(item.path))
    return {
      id: '',
      title: navMatch?.label || t('app.name'),
      subtitle: '',
      showHeader: true
    }
  }, [allNavItems, location.pathname, t, user?.timezone])

  const isDashboard = pageMeta.id === 'dashboard'
  const publicLocaleBase = language === 'ro' ? '/ro' : '/en'
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

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        width: '100%',
        overflowX: 'clip',
        position: 'relative',
        isolation: 'isolate',
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: -2,
          background: (theme) => theme.palette.mode === 'dark'
            ? `radial-gradient(900px 420px at -8% -6%, ${theme.palette.primary.main}24 0%, transparent 62%), radial-gradient(820px 380px at 108% -8%, ${theme.palette.secondary.main}22 0%, transparent 58%)`
            : `radial-gradient(900px 420px at -8% -6%, ${theme.palette.primary.main}20 0%, transparent 62%), radial-gradient(820px 380px at 108% -8%, ${theme.palette.secondary.main}1f 0%, transparent 58%)`
        },
        '&::after': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: -1,
          opacity: 0.08,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.65) 1px, transparent 0)',
          backgroundSize: '3px 3px'
        }
      }}
    >
      {isAuthenticated && (
        <Box component="nav" sx={{ width: { md: effectiveSidebarWidth }, flexShrink: { md: 0 }, minWidth: 0 }}>
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: false }}
            sx={{
              '& .MuiDrawer-paper': {
                width: isMobile ? SIDEBAR_WIDTH : effectiveSidebarWidth,
                transition: theme.transitions.create('width', {
                  duration: 200,
                  easing: theme.transitions.easing.easeInOut
                })
              }
            }}
          >
            <SideNav
              sections={navSections}
              pathname={location.pathname}
              collapsed={desktopCollapsed}
              isMobile={isMobile}
              userEmail={user?.email}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
              onNavigate={() => setMobileOpen(false)}
              collapseLabel={t('layout.collapseSidebar')}
              expandLabel={t('layout.expandSidebar')}
            />
          </Drawer>
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          overflowX: 'clip'
        }}
      >
        <TopBar
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          showTitle={pageMeta.showHeader}
          isAuthenticated={isAuthenticated}
          showMenuToggle={isAuthenticated && isMobile}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
          user={user}
          language={language}
          onLanguageChange={(value) => setLanguage(value)}
          themePreference={themePreference}
          onThemePreferenceChange={handleThemePreferenceChange}
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
            width: '100%',
            minWidth: 0,
            overflowX: 'clip',
            '& > *': {
              minWidth: 0
            }
          }}
        >
          <DemoDataBanner />
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
                <Button component="a" href={`${publicLocaleBase}/terms/`} size="small">{t('footer.terms')}</Button>
                <Button component="a" href={`${publicLocaleBase}/privacy/`} size="small">{t('footer.privacy')}</Button>
                <Button component="a" href={`${publicLocaleBase}/cookies/`} size="small">{t('footer.cookies')}</Button>
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
