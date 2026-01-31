import { Breadcrumbs, Box, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode[]
}

export default function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <Stack spacing={1}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ color: 'text.secondary', fontSize: 13 }}>
          {breadcrumbs.map((item, index) => (
            <Box key={index} sx={{ color: 'inherit' }}>
              {item}
            </Box>
          ))}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box>{actions}</Box>}
      </Stack>
    </Stack>
  )
}
