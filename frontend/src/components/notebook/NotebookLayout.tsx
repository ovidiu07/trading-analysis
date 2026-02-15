import { Box, Paper, Stack } from '@mui/material'
import { ReactNode } from 'react'

type NotebookLayoutProps = {
  isMobile: boolean
  isWideDesktop: boolean
  mobilePanel: 'list' | 'note'
  topNavigation: ReactNode
  listPanel: ReactNode
  editorPanel: ReactNode
  listCollapsed: boolean
  listCollapsedRail: ReactNode
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

const listExpandedMinWidth = 360
const listExpandedMaxWidth = 420
const collapsedRailWidth = 56
const desktopEditorMinWidth = 640

export default function NotebookLayout({
  isMobile,
  isWideDesktop,
  mobilePanel,
  topNavigation,
  listPanel,
  editorPanel,
  listCollapsed,
  listCollapsedRail
}: NotebookLayoutProps) {
  if (isMobile) {
    if (mobilePanel === 'note') {
      return (
        <Paper sx={panelSx}>
          {editorPanel}
        </Paper>
      )
    }
    return (
      <Paper sx={panelSx}>
        {listPanel}
      </Paper>
    )
  }

  const editorMinWidth = isWideDesktop ? desktopEditorMinWidth : 0

  return (
    <Stack sx={{ minHeight: 0, height: '100%', gap: 1.5 }}>
      <Paper
        data-testid="notebook-top-nav"
        sx={{
          ...panelSx,
          height: 'auto',
          minHeight: 'auto',
          borderRadius: 3,
          position: 'sticky',
          top: 0,
          zIndex: 3
        }}
      >
        {topNavigation}
      </Paper>

      <Box
        data-testid="notebook-layout-desktop"
        sx={{
          display: 'grid',
          gridTemplateColumns: isWideDesktop
            ? `${listCollapsed ? collapsedRailWidth : `minmax(${listExpandedMinWidth}px, ${listExpandedMaxWidth}px)`} minmax(${editorMinWidth}px, 1fr)`
            : '1fr',
          gridTemplateRows: isWideDesktop
            ? 'minmax(0, 1fr)'
            : `${listCollapsed ? `${collapsedRailWidth}px` : 'minmax(260px, 38vh)'} minmax(0, 1fr)`,
          gap: 2,
          minHeight: 0,
          height: '100%',
          minWidth: 0,
          '& > *': { minWidth: 0 }
        }}
      >
        <Paper data-testid="notebook-list-pane" sx={panelSx}>
          {listCollapsed ? listCollapsedRail : listPanel}
        </Paper>

        <Paper
          data-testid="notebook-editor-pane"
          data-editor-min-width={editorMinWidth}
          sx={{
            ...panelSx,
            minWidth: editorMinWidth
          }}
        >
          {editorPanel}
        </Paper>
      </Box>
    </Stack>
  )
}
