import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resendVerification, verifyEmail } from '../api/auth'
import { ApiError } from '../api/client'

export default function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!email || !token) {
        setStatus('error')
        setMessage('Verification link is missing or invalid.')
        return
      }
      try {
        await verifyEmail(email, token)
        setStatus('success')
        setMessage('Email verified. You can now sign in to your account.')
      } catch (err) {
        const apiErr = err as ApiError
        setStatus('error')
        setMessage(apiErr.message || 'Verification failed. The link may have expired.')
      }
    }

    run()
  }, [email, token])

  const handleResend = async () => {
    setResendMessage('')
    setResendError('')
    if (!email) {
      setResendError('Enter your email on the login screen to resend verification.')
      return
    }
    setResending(true)
    try {
      await resendVerification(email)
      setResendMessage('Verification email sent. Please check your inbox.')
    } catch (err) {
      const apiErr = err as ApiError
      setResendError(apiErr.message || 'Failed to resend verification email')
    } finally {
      setResending(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={700}>Verify your email</Typography>
              {status === 'loading' && (
                <Typography variant="body2" color="text.secondary">Checking your verification link…</Typography>
              )}
              {status !== 'loading' && message && (
                <Alert severity={status === 'success' ? 'success' : 'error'}>{message}</Alert>
              )}
              {status === 'success' && (
                <Button variant="contained" onClick={() => navigate('/login')}>Go to login</Button>
              )}
              {status === 'error' && (
                <Stack spacing={1}>
                  {resendMessage && <Alert severity="success">{resendMessage}</Alert>}
                  {resendError && <Alert severity="error">{resendError}</Alert>}
                  <Button variant="contained" onClick={handleResend} disabled={resending}>
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </Button>
                  <Button component={Link} to="/login" variant="outlined">
                    Back to login
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
