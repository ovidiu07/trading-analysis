import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Container, IconButton, InputAdornment, Link as MuiLink, Stack, TextField, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import loginHero from '../assets/login-hero.svg'

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
  const [showPassword, setShowPassword] = useState(false)

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
    <Container component="main" maxWidth="lg">
      <Box
        sx={{
          minHeight: { xs: 'auto', md: '80vh' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
          gap: { xs: 4, md: 6 },
          alignItems: 'center',
          py: { xs: 4, md: 8 }
        }}
      >
        <Stack spacing={{ xs: 3, md: 4 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontWeight: 700 }}>
                TV
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>TradejAudit</Typography>
                <Typography variant="caption" color="text.secondary">
                  Trading journal + notebook
                </Typography>
              </Box>
            </Stack>
            <Typography component="h1" variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '2rem', md: '2.75rem' } }}>
              Your edge is discipline. Build it daily.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              TradejAudit is your trading journal + notebook to capture setups, review execution, and track performance—so you can trade with clarity, not emotion.
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {[
              'Log trades in seconds. Review patterns in minutes.',
              'Turn notes into playbooks: setups, rules, mistakes, lessons.',
              'See performance by day, strategy, ticker, and tag.',
              'Attach screenshots and context to every trade.'
            ].map((text) => (
              <Stack key={text} direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleOutlineIcon color="primary" sx={{ mt: '2px' }} />
                <Typography variant="body2" color="text.secondary">
                  {text}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Typography variant="subtitle2" sx={{ fontStyle: 'italic' }}>
            Professionals don’t chase P&amp;L — they execute a process.
          </Typography>
          <Box
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(25,118,210,0.08), rgba(10,25,41,0.06))',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box
              component="img"
              src={loginHero}
              alt="Abstract trading workspace with charts"
              loading="lazy"
              sx={{ width: '100%', display: 'block', maxHeight: { xs: 220, md: 260 }, objectFit: 'cover' }}
            />
          </Box>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {['Built for disciplined execution', 'Your data stays private', 'Export anytime'].map((item) => (
              <Typography key={item} variant="caption" color="text.secondary">
                {item}
              </Typography>
            ))}
          </Stack>
        </Stack>

        <Card sx={{ width: '100%', boxShadow: { xs: 1, md: 3 } }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  <LockOutlinedIcon />
                </Avatar>
                <Typography component="h2" variant="h5" fontWeight={700}>
                  Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to keep your journal, analytics, and playbooks in sync.
                </Typography>
              </Stack>
              <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack spacing={2}>
                  <TextField
                    label="Email Address"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    error={!!formState.errors.email}
                    helperText={formState.errors.email?.message}
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    error={!!formState.errors.password}
                    helperText={formState.errors.password?.message}
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  {error && (
                    <Alert severity="error">
                      {error}
                    </Alert>
                  )}
                  <Button type="submit" fullWidth variant="contained" disabled={submitting}>
                    {submitting ? (
                      <>
                        <CircularProgress size={18} sx={{ mr: 1 }} />
                        Signing in
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                  <Button component={Link} to="/register" fullWidth variant="outlined">
                    Create free account
                  </Button>
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    By continuing you agree to the <MuiLink component={Link} to="/terms">Terms</MuiLink> and{' '}
                    <MuiLink component={Link} to="/privacy">Privacy Policy</MuiLink>.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    Encrypted in transit. No broker login required.
                  </Typography>
                  <MuiLink component={Link} to="/register" variant="body2" textAlign="center">
                    New here? Create an account
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
