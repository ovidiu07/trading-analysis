import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Container, FormControlLabel, Stack, TextField, Typography, Link as MuiLink } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import TurnstileWidget from '../components/ui/TurnstileWidget'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  legalAccepted: z.boolean().refine((value) => value, { message: 'You must accept the Terms and Privacy Policy.' })
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' })
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const termsVersion = import.meta.env.VITE_TERMS_VERSION || '2024-09-01'
  const privacyVersion = import.meta.env.VITE_PRIVACY_VERSION || '2024-09-01'
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
  const captchaBypassEnabled = !turnstileSiteKey && import.meta.env.DEV

  const onSubmit = async (data: FormValues) => {
    setError('')
    setSubmitting(true)
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        termsAccepted: true,
        termsVersion,
        privacyAccepted: true,
        privacyVersion,
        captchaToken: captchaBypassEnabled ? null : captchaToken,
        locale: navigator.language
      })
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
                  <FormControlLabel
                    control={<Checkbox {...register('legalAccepted')} />}
                    label={(
                      <Typography variant="body2">
                        I agree to the <MuiLink component={Link} to="/terms">Terms &amp; Conditions</MuiLink> and acknowledge the{' '}
                        <MuiLink component={Link} to="/privacy">Privacy Policy</MuiLink>.
                      </Typography>
                    )}
                  />
                  {formState.errors.legalAccepted && (
                    <Typography color="error" variant="body2">{formState.errors.legalAccepted.message}</Typography>
                  )}
                  {captchaBypassEnabled && (
                    <Alert severity="warning">
                      CAPTCHA bypass enabled in development. Configure Turnstile keys before production.
                    </Alert>
                  )}
                  {!captchaBypassEnabled && (
                    <TurnstileWidget
                      siteKey={turnstileSiteKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onError={() => setCaptchaToken(null)}
                      onExpire={() => setCaptchaToken(null)}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    For journaling and analytics only. Not investment advice.
                  </Typography>
                  {error && <Typography color="error" variant="body2">{error}</Typography>}
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={submitting || !formState.isValid || (!captchaBypassEnabled && !captchaToken)}
                  >
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
