import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    setError('')
    try {
      await forgotPassword(email)
      setMessage(t('forgotPassword.success'))
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2} component="form" onSubmit={handleSubmit}>
              <Typography variant="h5" fontWeight={700}>{t('forgotPassword.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('forgotPassword.subtitle')}
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label={t('forgotPassword.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? t('auth.sending') : t('forgotPassword.sendLink')}
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
