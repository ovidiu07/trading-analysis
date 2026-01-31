import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Card, CardContent, Container, Stack, TextField, Typography, Link as MuiLink } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (data: FormValues) => {
    setError('')
    setSubmitting(true)
    try {
      await registerUser(data.email, data.password)
      navigate('/trades')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
                  Create account
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start tracking trades and building performance insights.
                </Typography>
              </Stack>
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                  <TextField label="Email Address" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
                  <TextField label="Password" type="password" autoComplete="new-password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
                  {error && <Typography color="error" variant="body2">{error}</Typography>}
                  <Button type="submit" fullWidth variant="contained" disabled={submitting}>
                    Sign Up
                  </Button>
                  <MuiLink component={Link} to="/login" variant="body2" textAlign="center">
                    Already have an account? Sign in
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
