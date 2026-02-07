import { Box, Container, Stack, Typography } from '@mui/material'
import { useI18n } from '../i18n'

export default function TermsPage() {
  const { t } = useI18n()
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{t('legal.terms.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.disclaimer')}
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s1.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s1.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s2.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s2.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s3.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s3.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s4.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s4.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s5.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s5.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s6.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s6.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s7.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s7.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s8.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s8.body')}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">{t('legal.terms.sections.s9.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.terms.sections.s9.body')}
          </Typography>
        </Stack>
      </Stack>
    </Container>
  )
}
