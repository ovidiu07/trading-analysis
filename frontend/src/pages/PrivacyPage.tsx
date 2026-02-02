import { Box, Container, Stack, Typography } from '@mui/material'

export default function PrivacyPage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Privacy Policy</Typography>
          <Typography variant="body2" color="text.secondary">
            Draft for review — this content must be reviewed by qualified legal counsel for applicable jurisdictions.
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">1. Data we collect</Typography>
          <Typography variant="body2" color="text.secondary">
            Account data (email, password hash), trading notes and logs you submit, and technical data such as IP address, device, and user agent.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">2. How we use data</Typography>
          <Typography variant="body2" color="text.secondary">
            To provide the service, secure accounts, prevent abuse, and improve product performance. Optional analytics should be documented here.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">3. Legal bases (placeholder)</Typography>
          <Typography variant="body2" color="text.secondary">
            Insert lawful bases for processing after legal review (e.g., contract, legitimate interests, consent).
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">4. Retention</Typography>
          <Typography variant="body2" color="text.secondary">
            We retain data while your account is active and as needed for security, compliance, and backup purposes.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">5. Your rights</Typography>
          <Typography variant="body2" color="text.secondary">
            You can request access, correction, or deletion of your data. Contact us to exercise these rights.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">6. Security</Typography>
          <Typography variant="body2" color="text.secondary">
            We use encryption in transit, password hashing, and access controls to protect your data.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">7. Contact</Typography>
          <Typography variant="body2" color="text.secondary">
            Privacy requests: privacy@example.com (placeholder).
          </Typography>
        </Stack>
      </Stack>
    </Container>
  )
}
