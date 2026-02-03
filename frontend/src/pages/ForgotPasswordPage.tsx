import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import { ApiError } from '../api/client'

export default function ForgotPasswordPage() {
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
      setMessage('If an account exists for this email, a reset link has been sent.')
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to request password reset')
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
              <Typography variant="h5" fontWeight={700}>Reset your password</Typography>
              <Typography variant="body2" color="text.secondary">
                Enter the email associated with your account. We'll send a reset link if it exists.
              </Typography>
              {message && <Alert severity="success">{message}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
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
