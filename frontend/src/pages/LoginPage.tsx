import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Container, Link as MuiLink, TextField, Typography } from '@mui/material'
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
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
          <TextField margin="normal" fullWidth label="Email Address" autoComplete="email" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
          <TextField margin="normal" fullWidth label="Password" type="password" autoComplete="current-password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={submitting}>
            Sign In
          </Button>
          <MuiLink component={Link} to="/register" variant="body2">
            Don't have an account? Register
          </MuiLink>
        </Box>
      </Box>
    </Container>
  )
}
