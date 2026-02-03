import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { resendVerification } from '../api/auth'
import { ApiError } from '../api/client'

export default function CheckEmailPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const email = params.get('email') || ''
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
    setMessage('')
    setError('')
    if (!email) {
      setError('Enter your email on the login screen to resend verification.')
      return
    }
    setSending(true)
    try {
      await resendVerification(email)
      setMessage('Verification email sent. Please check your inbox.')
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to resend verification email')
    } finally {
      setSending(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={700}>Check your email</Typography>
              <Typography variant="body2" color="text.secondary">
                We sent a verification link to {email || 'your inbox'}. Confirm your email to activate your TradeVault account.
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <Button variant="contained" onClick={handleResend} disabled={sending}>
                {sending ? 'Sending…' : 'Resend verification email'}
              </Button>
              <Button component={Link} to="/login" variant="outlined">
                Back to login
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
