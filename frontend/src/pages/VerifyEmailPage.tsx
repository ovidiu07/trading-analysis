import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resendVerification, verifyEmail } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

export default function VerifyEmailPage() {
  const { t, locale } = useI18n()
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
        setMessage(t('verifyEmail.errors.invalidLink'))
        return
      }
      try {
        await verifyEmail(email, token)
        setStatus('success')
        setMessage(t('verifyEmail.success'))
      } catch (err) {
        const apiErr = err as ApiError
        setStatus('error')
        setMessage(translateApiError(apiErr, t, 'verifyEmail.errors.failed'))
      }
    }

    run()
  }, [email, token])

  const handleResend = async () => {
    setResendMessage('')
    setResendError('')
    if (!email) {
      setResendError(t('checkEmail.errors.enterEmailOnLogin'))
      return
    }
    setResending(true)
    try {
      await resendVerification(email, locale)
      setResendMessage(t('login.success.verificationSent'))
    } catch (err) {
      const apiErr = err as ApiError
      setResendError(translateApiError(apiErr, t))
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
              <Typography variant="h5" fontWeight={700}>{t('verifyEmail.title')}</Typography>
              {status === 'loading' && (
                <Typography variant="body2" color="text.secondary">{t('verifyEmail.loading')}</Typography>
              )}
              {status !== 'loading' && message && (
                <Alert severity={status === 'success' ? 'success' : 'error'}>{message}</Alert>
              )}
              {status === 'success' && (
                <Button variant="contained" onClick={() => navigate('/login')}>{t('verifyEmail.goToLogin')}</Button>
              )}
              {status === 'error' && (
                <Stack spacing={1}>
                  {resendMessage && <Alert severity="success">{resendMessage}</Alert>}
                  {resendError && <Alert severity="error">{resendError}</Alert>}
                  <Button variant="contained" onClick={handleResend} disabled={resending}>
                    {resending ? t('auth.sending') : t('login.actions.resendVerification')}
                  </Button>
                  <Button component={Link} to="/login" variant="outlined">
                    {t('forgotPassword.backToLogin')}
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
