import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Container, TextField, Typography, Link as MuiLink } from '@mui/material'
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
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Create account
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
          <TextField margin="normal" fullWidth label="Email Address" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
          <TextField margin="normal" fullWidth label="Password" type="password" autoComplete="new-password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={submitting}>
            Sign Up
          </Button>
          <MuiLink component={Link} to="/login" variant="body2">
            Already have an account? Sign in
          </MuiLink>
        </Box>
      </Box>
    </Container>
  )
}
