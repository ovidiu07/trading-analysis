import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'

export default function ResetPasswordPage() {
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
      setError('Reset link is missing or invalid.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(email, token, newPassword)
      setMessage('Password updated successfully. You can now sign in.')
      setTimeout(() => navigate('/login'), 800)
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to reset password')
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
              <Typography variant="h5" fontWeight={700}>Set a new password</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a strong password to secure your TradeVault account.
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <TextField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
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
