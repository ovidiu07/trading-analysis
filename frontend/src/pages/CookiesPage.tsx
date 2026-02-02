import { Box, Container, Stack, Typography } from '@mui/material'

export default function CookiesPage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Cookie Policy</Typography>
          <Typography variant="body2" color="text.secondary">
            Draft for review — this content must be reviewed by qualified legal counsel for applicable jurisdictions.
          </Typography>
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6">Essential cookies</Typography>
          <Typography variant="body2" color="text.secondary">
            We use essential cookies for authentication and session security.
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h6">Analytics cookies (placeholder)</Typography>
          <Typography variant="body2" color="text.secondary">
            If analytics are enabled, list providers, purposes, and opt-out instructions here.
          </Typography>
        </Stack>
      </Stack>
    </Container>
  )
}
