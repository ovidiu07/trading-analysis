import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { resendVerification } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { trackEvent } from '../utils/analytics/ga4'

export default function CheckEmailPage() {
  const { t, locale } = useI18n()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const email = params.get('email') || ''
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    trackEvent('auth_email_confirm_view', {
      method: 'email',
      success: true,
      email_present: Boolean(email),
      view_context: 'post_signup',
      feature_area: 'auth'
    })
  }, [email])

  const handleResend = async () => {
    setMessage('')
    setError('')
    if (!email) {
      setError(t('checkEmail.errors.enterEmailOnLogin'))
      return
    }
    setSending(true)
    try {
      await resendVerification(email, locale)
      setMessage(t('login.success.verificationSent'))
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
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
              <Typography variant="h5" fontWeight={700}>{t('checkEmail.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('checkEmail.subtitle', { email: email || t('checkEmail.yourInbox') })}
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <Button variant="contained" onClick={handleResend} disabled={sending}>
                {sending ? t('auth.sending') : t('login.actions.resendVerification')}
              </Button>
              <Button component={Link} to="/login" variant="outlined">
                {t('forgotPassword.backToLogin')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
