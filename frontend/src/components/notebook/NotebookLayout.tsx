import { Box, Paper, Stack } from '@mui/material'
import { ReactNode } from 'react'

type NotebookLayoutProps = {
  isMobile: boolean
  mobilePanel: 'list' | 'note'
  leftRail: ReactNode
  middlePanel: ReactNode
  rightPanel: ReactNode
  listCollapsed?: boolean
}

const panelSx = {
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  borderRadius: 3
}

export default function NotebookLayout({
  isMobile,
  mobilePanel,
  leftRail,
  middlePanel,
  rightPanel,
  listCollapsed = false
}: NotebookLayoutProps) {
  if (isMobile) {
    if (mobilePanel === 'note') {
      return (
        <Paper sx={panelSx}>
          {rightPanel}
        </Paper>
      )
    }
    return (
      <Paper sx={panelSx}>
        {middlePanel}
      </Paper>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: listCollapsed
          ? '220px 84px minmax(0, 1fr)'
          : '220px minmax(300px, 390px) minmax(0, 1fr)',
        gap: 1.5,
        minHeight: 0,
        height: '100%'
      }}
    >
      <Paper sx={panelSx}>
        {leftRail}
      </Paper>
      <Paper sx={panelSx}>
        {middlePanel}
      </Paper>
      <Paper sx={panelSx}>
        {rightPanel}
      </Paper>
    </Box>
  )
}
