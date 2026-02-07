import { Box, Container, Stack, Typography } from '@mui/material'
import { useI18n } from '../i18n'

export default function CookiesPage() {
  const { t } = useI18n()
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{t('legal.cookies.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.disclaimer')}
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.cookies.sections.s1.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.cookies.sections.s1.body')}
          </Typography>
        </Stack>

      </Stack>
    </Container>
  )
}
