import { Box, Skeleton, Stack } from '@mui/material'

type LoadingStateProps = {
  rows?: number
  height?: number
}

export default function LoadingState({ rows = 3, height = 20 }: LoadingStateProps) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: rows }, (_, idx) => (
        <Skeleton key={idx} variant="rectangular" height={height} sx={{ borderRadius: 2 }} />
      ))}
      <Box sx={{ height: 1 }} />
    </Stack>
  )
}
