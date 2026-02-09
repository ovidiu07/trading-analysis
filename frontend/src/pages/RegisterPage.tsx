import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Card, CardContent, Checkbox, Container, FormControlLabel, Stack, TextField, Typography, Link as MuiLink } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { ApiError } from '../api/client'
import { trackEvent } from '../utils/analytics/ga4'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  legalAccepted: z.boolean().refine((value) => value, { message: 'LEGAL_REQUIRED' })
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { t, locale } = useI18n()
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' })
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const termsVersion = import.meta.env.VITE_TERMS_VERSION || '2024-09-01'
  const privacyVersion = import.meta.env.VITE_PRIVACY_VERSION || '2024-09-01'
  const language = locale.startsWith('ro') ? 'ro' : 'en'
  const publicTermsUrl = `/${language}/terms/`
  const publicPrivacyUrl = `/${language}/privacy/`

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
        locale
      })
      trackEvent('auth_sign_up_submit', {
        method: 'email',
        success: true,
        feature_area: 'auth'
      })
      navigate(`/register/confirm?email=${encodeURIComponent(data.email)}`)
    } catch (err) {
      const apiErr = err as ApiError
      trackEvent('auth_sign_up_submit', {
        method: 'email',
        success: false,
        error_code: apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN'),
        error_message: apiErr.rawMessage || apiErr.message,
        feature_area: 'auth'
      })
      setError(translateApiError(err, t))
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
                  {t('register.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('register.subtitle')}
                </Typography>
              </Stack>
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                  <TextField label={t('register.email')} {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email ? t('register.validation.email') : ''} />
                  <TextField label={t('register.password')} type="password" autoComplete="new-password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password ? t('register.validation.password') : ''} />
                  <FormControlLabel
                    control={<Checkbox {...register('legalAccepted')} />}
                    label={(
                      <Typography variant="body2">
                        {t('register.legalPrefix')} <MuiLink href={publicTermsUrl}>{t('register.termsAndConditions')}</MuiLink> {t('register.andAcknowledge')}{' '}
                        <MuiLink href={publicPrivacyUrl}>{t('register.privacyPolicy')}</MuiLink>.
                      </Typography>
                    )}
                  />
                  {formState.errors.legalAccepted && (
                    <Typography color="error" variant="body2">{t('register.validation.legal')}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {t('app.disclaimer')}
                  </Typography>
                  {error && <Typography color="error" variant="body2">{error}</Typography>}
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={submitting || !formState.isValid}
                  >
                    {t('auth.signup')}
                  </Button>
                  <MuiLink component={Link} to="/login" variant="body2" textAlign="center">
                    {t('register.alreadyHaveAccount')}
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
