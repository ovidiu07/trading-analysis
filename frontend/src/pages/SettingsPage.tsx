import { Card, CardContent, Stack, TextField, Typography, Button } from '@mui/material'

export default function SettingsPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Settings</Typography>
        <Stack spacing={2}>
          <TextField label="Base currency" defaultValue="USD" />
          <TextField label="Timezone" defaultValue="Europe/Bucharest" />
          <Button variant="contained">Save</Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
