import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography
} from '@mui/material'

type LegalDocumentSection = {
  id: string
  title: string
  body: string
}

type LegalDocumentLayoutProps = {
  disclaimer: string
  sections: LegalDocumentSection[]
  tocLabel: string
  jumpLabel: string
}

export default function LegalDocumentLayout({
  disclaimer,
  sections,
  tocLabel,
  jumpLabel
}: LegalDocumentLayoutProps) {
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {disclaimer}
      </Typography>

      <Accordion
        disableGutters
        sx={{
          display: { xs: 'block', lg: 'none' },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          '&::before': { display: 'none' }
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="legal-mobile-nav-content" id="legal-mobile-nav-header">
          <Typography variant="subtitle2">{jumpLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.75}>
            {sections.map((section) => (
              <Button
                key={section.id}
                component="a"
                href={`#${section.id}`}
                variant="text"
                sx={{
                  justifyContent: 'flex-start',
                  minHeight: 40,
                  px: 1,
                  textAlign: 'left'
                }}
              >
                {section.title}
              </Button>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr)' },
          alignItems: 'start',
          gap: 2,
          minWidth: 0,
          '& > *': {
            minWidth: 0
          }
        }}
      >
        <Card
          component="aside"
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'sticky',
            top: 96,
            height: 'fit-content'
          }}
          aria-label={tocLabel}
        >
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {tocLabel}
              </Typography>
              {sections.map((section) => (
                <Button
                  key={section.id}
                  component="a"
                  href={`#${section.id}`}
                  variant="text"
                  sx={{
                    justifyContent: 'flex-start',
                    minHeight: 40,
                    px: 1,
                    textAlign: 'left'
                  }}
                >
                  {section.title}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card component="article">
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2.5}>
              {sections.map((section) => (
                <Box
                  key={section.id}
                  component="section"
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  sx={{ scrollMarginTop: 96 }}
                >
                  <Typography id={`${section.id}-title`} component="h2" variant="h6" sx={{ mb: 1 }}>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {section.body}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}
