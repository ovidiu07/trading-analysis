import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

type PageHeroProps = {
  title: string
  description?: string
  eyebrow?: string
  icon?: ReactNode
  action?: ReactNode
  meta?: ReactNode
}

export default function PageHero({ title, description, eyebrow, icon, action, meta }: PageHeroProps) {
  return (
    <Card className="surface-hero interactive-lift" sx={{ position: 'relative', overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            {eyebrow && (
              <Typography variant="caption" sx={{ letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary' }}>
                {eyebrow}
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {icon && (
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    flexShrink: 0
                  }}
                >
                  {icon}
                </Box>
              )}
              <Typography variant="h2" sx={{ fontSize: { xs: 26, md: 30 }, overflowWrap: 'anywhere' }}>
                {title}
              </Typography>
            </Stack>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: { xs: '100%', md: '72ch' }, overflowWrap: 'anywhere' }}>
                {description}
              </Typography>
            )}
            {meta && <Box>{meta}</Box>}
          </Stack>
          {action && <Box sx={{ width: { xs: '100%', md: 'auto' } }}>{action}</Box>}
        </Stack>
      </CardContent>
    </Card>
  )
}
