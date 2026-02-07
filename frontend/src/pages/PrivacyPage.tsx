import { Box, Container, Stack, Typography } from '@mui/material'
import { useI18n } from '../i18n'

export default function PrivacyPage() {
  const { t } = useI18n()
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{t('legal.privacy.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.disclaimer')}
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s1.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s1.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s2.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s2.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s3.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s3.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s4.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s4.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s5.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s5.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s6.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s6.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.privacy.sections.s7.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.sections.s7.body')}
          </Typography>
        </Stack>
      </Stack>
    </Container>
  )
}
