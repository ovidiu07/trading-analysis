import { Box, Container, Stack, Typography } from '@mui/material'

export default function TermsPage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Terms &amp; Conditions</Typography>
          <Typography variant="body2" color="text.secondary">
            Draft for review — this content must be reviewed by qualified legal counsel for applicable jurisdictions.
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">1. Service description</Typography>
          <Typography variant="body2" color="text.secondary">
            TradeJAudit provides a trading journal and analytics workspace for recording trades, notes, and reflections.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">2. Eligibility &amp; account</Typography>
          <Typography variant="body2" color="text.secondary">
            You are responsible for maintaining the confidentiality of your account credentials and the accuracy of information you submit.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">3. User content</Typography>
          <Typography variant="body2" color="text.secondary">
            You retain ownership of your notes and data. You grant TradeJAudit a limited license to process and display your content to provide the service.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">4. No investment advice &amp; risk disclosure</Typography>
          <Typography variant="body2" color="text.secondary">
            TradeJAudit does not provide investment, legal, tax, or financial advice, and is not a broker-dealer. You are solely responsible for
            your trading decisions. Past performance does not guarantee future results. Trading involves substantial risk of loss.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">5. Prohibited use</Typography>
          <Typography variant="body2" color="text.secondary">
            You agree not to use the service to upload unlawful content, infringe intellectual property, or attempt to compromise security.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">6. Data retention &amp; deletion</Typography>
          <Typography variant="body2" color="text.secondary">
            Retention periods and deletion workflows are described in the Privacy Policy. You may request account deletion as described there.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">7. Changes to these terms</Typography>
          <Typography variant="body2" color="text.secondary">
            We may update these terms from time to time. We will provide notice of material changes and capture your acceptance for new versions.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">8. Governing law</Typography>
          <Typography variant="body2" color="text.secondary">
            Insert governing law and jurisdiction after legal review.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">9. Contact</Typography>
          <Typography variant="body2" color="text.secondary">
            Contact support at support@example.com (placeholder).
          </Typography>
        </Stack>
      </Stack>
    </Container>
  )
}
