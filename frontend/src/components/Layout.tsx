import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Layout() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f7f9' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            TradeVault
          </Typography>
          {isAuthenticated && (
            <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
              <Button color="inherit" component={Link} to="/dashboard">Dashboard</Button>
              <Button color="inherit" component={Link} to="/trades">Trades</Button>
              <Button color="inherit" component={Link} to="/analytics">Analytics</Button>
              <Button color="inherit" component={Link} to="/settings">Settings</Button>
            </Stack>
          )}
          {isAuthenticated ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ maxWidth: 200, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.email}
              </Typography>
              <Button color="inherit" component={Link} to="/profile">Profile</Button>
              <Button color="inherit" onClick={handleLogout}>Logout</Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button color="inherit" component={Link} to="/login">Login</Button>
              <Button variant="outlined" color="inherit" component={Link} to="/register">Register</Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
