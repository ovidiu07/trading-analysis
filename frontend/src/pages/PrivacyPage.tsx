import { Container } from '@mui/material'
import { useI18n } from '../i18n'
import LegalDocumentLayout from '../components/legal/LegalDocumentLayout'

export default function PrivacyPage() {
  const { t } = useI18n()
  const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((sectionKey) => ({
    id: `privacy-${sectionKey}`,
    title: t(`legal.privacy.sections.${sectionKey}.title`),
    body: t(`legal.privacy.sections.${sectionKey}.body`)
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
