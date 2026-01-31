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
import SettingsIcon from '@mui/icons-material/Settings'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import LogoutIcon from '@mui/icons-material/Logout'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMemo, useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = useMemo(() => ([
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { label: 'Trades', path: '/trades', icon: <TableChartIcon /> },
    { label: 'Calendar', path: '/calendar', icon: <CalendarMonthIcon /> },
    { label: 'Notebook', path: '/notebook', icon: <NoteIcon /> },
    { label: 'Analytics', path: '/analytics', icon: <InsightsIcon /> },
    { label: 'Settings', path: '/settings', icon: <SettingsIcon /> }
  ]), [])

  const pageTitle = useMemo(() => {
    const match = navItems.find((item) => location.pathname.startsWith(item.path))
    if (match) return match.label
    if (location.pathname.startsWith('/profile')) return 'Profile'
    return 'TradeVault'
  }, [location.pathname, navItems])

  const drawer = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ color: 'common.white' }}>
          TradeVault
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
            <ListItemText primary={item.label} />
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
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {isAuthenticated && isMobile && (
                <IconButton onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6">{pageTitle}</Typography>
            </Stack>
            {isAuthenticated ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<AccountCircleIcon />}
                  component={Link}
                  to="/profile"
                >
                  Profile
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button color="inherit" component={Link} to="/login">Login</Button>
                <Button variant="contained" component={Link} to="/register">Register</Button>
              </Stack>
            )}
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
