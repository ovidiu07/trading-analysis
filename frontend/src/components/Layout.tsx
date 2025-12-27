import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f7f9' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>TradeVault</Typography>
          <Button color="inherit" component={Link} to="/dashboard">Dashboard</Button>
          <Button color="inherit" component={Link} to="/trades">Trades</Button>
          <Button color="inherit" component={Link} to="/analytics">Analytics</Button>
          <Button color="inherit" component={Link} to="/settings">Settings</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
