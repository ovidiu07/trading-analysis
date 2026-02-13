import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Container, IconButton, InputAdornment, Link as MuiLink, Stack, TextField, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import loginHero from '../assets/login-hero.svg'
import { resendVerification } from '../api/auth'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { trackEvent } from '../utils/analytics/ga4'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { t, language, locale } = useI18n()
  const { register, handleSubmit, formState, watch } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resending, setResending] = useState(false)
  const loginCardRef = useRef<HTMLDivElement | null>(null)
  const emailInputRef = useRef<HTMLInputElement | null>(null)

  const emailValue = watch('email')
  const emailField = register('email')
  const formAnchorId = 'login-form'
  const publicTermsUrl = `/${language}/terms/`
  const publicPrivacyUrl = `/${language}/privacy/`

  const from = (location.state as { from?: string })?.from || '/trades'

  const onSubmit = async (data: FormValues) => {
    setError('')
    setErrorCode(undefined)
    setResendMessage('')
    setSubmitting(true)
    try {
      await login(data.email, data.password)
      trackEvent('auth_login_submit', {
        method: 'email',
        success: true,
        feature_area: 'auth'
      })
      navigate(from, { replace: true })
    } catch (err) {
      const apiErr = err as ApiError
      trackEvent('auth_login_submit', {
        method: 'email',
        success: false,
        error_code: apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN'),
        error_message: apiErr.rawMessage || apiErr.message,
        feature_area: 'auth'
      })
      setError(translateApiError(apiErr, t, 'errors.unauthorized'))
      setErrorCode(apiErr.code)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResendMessage('')
    if (!emailValue) {
      setError(t('login.errors.enterEmailToResend'))
      return
    }
    setResending(true)
    try {
      await resendVerification(emailValue, locale)
      setResendMessage(t('login.success.verificationSent'))
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    } finally {
      setResending(false)
    }
  }

  const handleLoginCta = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    loginCardRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    })
    window.setTimeout(() => {
      emailInputRef.current?.focus({ preventScroll: true })
    }, 320)
  }

  return (
    <>
      <Container
        component="main"
        maxWidth="lg"
        sx={{
          pb: { xs: 'calc(92px + env(safe-area-inset-bottom))', sm: 0 }
        }}
      >
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
                  <Typography variant="h6" fontWeight={700}>{t('app.name')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('login.brand.subtitle')}
                  </Typography>
                </Box>
              </Stack>
              <Typography component="h1" variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '2rem', md: '2.75rem' } }}>
                {t('login.hero.title')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('login.hero.subtitle')}
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {[
                t('login.hero.points.fastLogging'),
                t('login.hero.points.playbooks'),
                t('login.hero.points.performance'),
                t('login.hero.points.attachments')
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
              {t('login.hero.quote')}
            </Typography>
            <Box
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.14 : 0.09)}, ${alpha(theme.palette.background.default, theme.palette.mode === 'light' ? 0.06 : 0.12)})`,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box
                component="img"
                src={loginHero}
                alt={t('login.hero.imageAlt')}
                loading="lazy"
                sx={{ width: '100%', display: 'block', maxHeight: { xs: 220, md: 260 }, objectFit: 'cover' }}
              />
            </Box>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {[t('login.hero.badges.discipline'), t('login.hero.badges.privacy'), t('login.hero.badges.export')].map((item) => (
                <Typography key={item} variant="caption" color="text.secondary">
                  {item}
                </Typography>
              ))}
            </Stack>
          </Stack>

          <Card
            id={formAnchorId}
            ref={loginCardRef}
            sx={{ width: '100%', boxShadow: { xs: 1, md: 3 } }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={3}>
                <Stack spacing={1}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                    <LockOutlinedIcon />
                  </Avatar>
                  <Typography component="h2" variant="h5" fontWeight={700}>
                    {t('login.form.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('login.form.subtitle')}
                  </Typography>
                </Stack>
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <Stack spacing={2}>
                    <TextField
                      label={t('login.form.email')}
                      type="email"
                      autoComplete="email"
                      {...emailField}
                      inputRef={(element) => {
                        emailField.ref(element)
                        emailInputRef.current = element
                      }}
                      error={!!formState.errors.email}
                      helperText={formState.errors.email ? t('login.validation.email') : ''}
                      fullWidth
                    />
                    <TextField
                      label={t('login.form.password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...register('password')}
                      error={!!formState.errors.password}
                      helperText={formState.errors.password ? t('login.validation.password') : ''}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
                    {errorCode === 'EMAIL_NOT_VERIFIED' && (
                      <Stack spacing={1}>
                        {resendMessage && <Alert severity="success">{resendMessage}</Alert>}
                        <Button variant="outlined" onClick={handleResend} disabled={resending}>
                          {resending ? t('auth.sending') : t('login.actions.resendVerification')}
                        </Button>
                      </Stack>
                    )}
                    <Button type="submit" fullWidth variant="contained" disabled={submitting}>
                      {submitting ? (
                        <>
                          <CircularProgress size={18} sx={{ mr: 1 }} />
                          {t('auth.signingIn')}
                        </>
                      ) : (
                        t('auth.signin')
                      )}
                    </Button>
                    <Button component={Link} to="/register" fullWidth variant="outlined">
                      {t('login.actions.createFreeAccount')}
                    </Button>
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      {t('login.form.agreePrefix')} <MuiLink href={publicTermsUrl}>{t('footer.terms')}</MuiLink> {t('login.form.and')}{' '}
                      <MuiLink href={publicPrivacyUrl}>{t('login.form.privacyPolicy')}</MuiLink>.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      {t('login.form.securityNote')}
                    </Typography>
                    <MuiLink component={Link} to="/forgot-password" variant="body2" textAlign="center">
                      {t('login.actions.forgotPassword')}
                    </MuiLink>
                    <MuiLink component={Link} to="/register" variant="body2" textAlign="center">
                      {t('login.actions.newHere')}
                    </MuiLink>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>

      <Box
        sx={(theme) => ({
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          zIndex: theme.zIndex.appBar + 1,
          px: 1.5,
          pt: 1,
          pb: 'calc(10px + env(safe-area-inset-bottom))',
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: alpha(theme.palette.background.paper, 0.94),
          backdropFilter: 'blur(10px)',
          display: { xs: 'block', sm: 'none' }
        })}
      >
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            component={Link}
            to="/register"
            aria-label={t('login.mobileCta.create')}
          >
            {t('login.mobileCta.create')}
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleLoginCta}
            aria-controls={formAnchorId}
            aria-label={t('login.mobileCta.login')}
          >
            {t('login.mobileCta.login')}
          </Button>
        </Stack>
      </Box>
    </>
  )
}
