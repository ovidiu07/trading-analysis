import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import TableChartIcon from '@mui/icons-material/TableChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import NoteIcon from '@mui/icons-material/Note'
import InsightsIcon from '@mui/icons-material/Insights'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SettingsIcon from '@mui/icons-material/Settings'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import LogoutIcon from '@mui/icons-material/Logout'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMemo, useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isCompact = useMediaQuery('(max-width:560px)')
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = useMemo(() => {
    const items = [
      { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { label: 'Trades', path: '/trades', icon: <TableChartIcon /> },
      { label: 'Calendar', path: '/calendar', icon: <CalendarMonthIcon /> },
      { label: 'Notebook', path: '/notebook', icon: <NoteIcon /> },
      { label: 'Analytics', path: '/analytics', icon: <InsightsIcon /> },
      { label: 'Insights', path: '/insights', icon: <MenuBookIcon /> },
      { label: 'Settings', path: '/settings', icon: <SettingsIcon /> }
    ]

    if (user?.role === 'ADMIN') {
      items.push({ label: 'Admin', path: '/admin/content', icon: <AdminPanelSettingsIcon /> })
    }

    return items
  }, [user?.role])

  const pageTitle = useMemo(() => {
    const match = navItems.find((item) => location.pathname.startsWith(item.path))
    if (match) return match.label
    if (location.pathname.startsWith('/profile')) return 'Profile'
    return 'TradeJAudit'
  }, [location.pathname, navItems])

  const drawer = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ color: 'common.white' }}>
          TradeJAudit
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)' }}>
          Trading intelligence hub
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />
      <List sx={{ px: 1, pt: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={Link}
            to={item.path}
            selected={location.pathname.startsWith(item.path)}
            title={item.label}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: 'inherit',
              '&.Mui-selected': {
                bgcolor: 'rgba(148, 163, 184, 0.2)',
                color: 'common.white'
              },
              '&:hover': {
                bgcolor: 'rgba(148, 163, 184, 0.15)'
              }
            }}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true }} sx={{ minWidth: 0 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      {isAuthenticated && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)', mb: 2 }} />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              {(user?.email || 'U')[0].toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ color: 'common.white', fontWeight: 600 }}>
                {user?.email || 'Trader'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)' }}>
                {user?.baseCurrency || 'USD'} · {user?.timezone || 'UTC'}
              </Typography>
            </Box>
            <Tooltip title="Logout" arrow>
              <IconButton color="inherit" size="small" onClick={handleLogout}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isAuthenticated && (
        <Box component="nav" sx={{ width: { md: 260 }, flexShrink: { md: 0 } }}>
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: 260
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
          minHeight: '100vh',
          alignItems: isCompact ? 'center' : 'stretch'
        }}
      >
        <AppBar position="sticky" elevation={0} sx={{ width: '100%' }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' }, py: { xs: 1, sm: 0 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              {isAuthenticated && isMobile && (
                <IconButton onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}>{pageTitle}</Typography>
            </Stack>
            {isAuthenticated ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<AccountCircleIcon />}
                  component={Link}
                  to="/profile"
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  Profile
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  Logout
                </Button>
                <Tooltip title="Profile">
                  <IconButton color="inherit" component={Link} to="/profile" sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                    <AccountCircleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Logout">
                  <IconButton color="inherit" onClick={handleLogout} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                    <LogoutIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button color="inherit" component={Link} to="/login">Login</Button>
                <Button variant="contained" component={Link} to="/register">Register</Button>
              </Stack>
            )}
          </Toolbar>
        </AppBar>
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2.5, md: 4 },
            px: { xs: 2, sm: 3 },
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
                For journaling and analytics only. Not investment advice.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button component={Link} to="/terms" size="small">Terms</Button>
                <Button component={Link} to="/privacy" size="small">Privacy</Button>
                <Button component={Link} to="/cookies" size="small">Cookies</Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}
