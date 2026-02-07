import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    if (!email || !token) {
      setError(t('resetPassword.errors.invalidLink'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('resetPassword.errors.shortPassword'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.errors.passwordMismatch'))
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(email, token, newPassword)
      setMessage(t('resetPassword.success'))
      setTimeout(() => navigate('/login'), 800)
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
              <Typography variant="h5" fontWeight={700}>{t('resetPassword.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('resetPassword.subtitle')}
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label={t('resetPassword.newPassword')}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <TextField
                label={t('resetPassword.confirmPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? t('auth.updating') : t('resetPassword.update')}
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
