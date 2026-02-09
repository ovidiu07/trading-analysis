import { Container } from '@mui/material'
import { useI18n } from '../i18n'
import LegalDocumentLayout from '../components/legal/LegalDocumentLayout'

export default function CookiesPage() {
  const { t } = useI18n()
  const sections = ['s1'].map((sectionKey) => ({
    id: `cookies-${sectionKey}`,
    title: t(`legal.cookies.sections.${sectionKey}.title`),
    body: t(`legal.cookies.sections.${sectionKey}.body`)
  }))

  return (
    <Container maxWidth="lg" sx={{ minWidth: 0 }}>
      <LegalDocumentLayout
        disclaimer={t('legal.disclaimer')}
        tocLabel={t('legal.tableOfContents')}
        jumpLabel={t('legal.jumpToSection')}
        sections={sections}
      />
    </Container>
  )
}
