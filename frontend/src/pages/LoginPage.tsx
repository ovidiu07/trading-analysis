import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Card, CardContent, Container, Link as MuiLink, Stack, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string })?.from || '/trades'

  const onSubmit = async (data: FormValues) => {
    setError('')
    setSubmitting(true)
    try {
      await login(data.email, data.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={1} alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                  Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to review your latest trading performance.
                </Typography>
              </Stack>
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                  <TextField label="Email Address" autoComplete="email" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
                  <TextField label="Password" type="password" autoComplete="current-password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
                  {error && <Typography color="error" variant="body2">{error}</Typography>}
                  <Button type="submit" fullWidth variant="contained" disabled={submitting}>
                    Sign In
                  </Button>
                  <MuiLink component={Link} to="/register" variant="body2" textAlign="center">
                    Don't have an account? Register
                  </MuiLink>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
