import { Box, Paper } from '@mui/material'
import { ReactNode } from 'react'

type NotebookLayoutProps = {
  isMobile: boolean
  mobilePanel: 'list' | 'note'
  leftRail: ReactNode
  middlePanel: ReactNode
  rightPanel: ReactNode
  leftCollapsed: boolean
  listCollapsed: boolean
  editorCollapsed: boolean
  leftCollapsedRail: ReactNode
  listCollapsedRail: ReactNode
  editorCollapsedRail: ReactNode
}

const panelSx = {
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  borderRadius: 3,
  position: 'relative' as const
}

const leftExpandedWidth = 220
const listExpandedWidth = 360
const collapsedRailWidth = 56

export default function NotebookLayout({
  isMobile,
  mobilePanel,
  leftRail,
  middlePanel,
  rightPanel,
  leftCollapsed,
  listCollapsed,
  editorCollapsed,
  leftCollapsedRail,
  listCollapsedRail,
  editorCollapsedRail
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
        gridTemplateColumns: `${leftCollapsed ? collapsedRailWidth : leftExpandedWidth}px ${listCollapsed ? collapsedRailWidth : `minmax(280px, ${listExpandedWidth}px)`} ${editorCollapsed ? collapsedRailWidth : 'minmax(0, 1fr)'}`,
        gap: 1.5,
        minHeight: 0,
        height: '100%'
      }}
    >
      <Paper sx={panelSx}>
        {leftCollapsed ? leftCollapsedRail : leftRail}
      </Paper>
      <Paper sx={panelSx}>
        {listCollapsed ? listCollapsedRail : middlePanel}
      </Paper>
      <Paper sx={panelSx}>
        {editorCollapsed ? editorCollapsedRail : rightPanel}
      </Paper>
    </Box>
  )
}
