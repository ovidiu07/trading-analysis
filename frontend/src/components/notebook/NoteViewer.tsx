import { Box, Typography } from '@mui/material'

type NoteViewerProps = {
  html: string
  emptyText: string
}

export default function NoteViewer({ html, emptyText }: NoteViewerProps) {
  if (!html.trim()) {
    return <Typography color="text.secondary">{emptyText}</Typography>
  }

  return (
    <Box
      sx={{
        '& h1': {
          fontSize: '1.7rem',
          fontWeight: 700,
          marginTop: 0,
          marginBottom: 1
        },
        '& h2': {
          fontSize: '1.35rem',
          fontWeight: 700,
          marginTop: 2,
          marginBottom: 1
        },
        '& h3': {
          fontSize: '1.1rem',
          fontWeight: 700,
          marginTop: 1.5,
          marginBottom: 0.5
        },
        '& p': {
          margin: '0 0 0.9rem 0',
          lineHeight: 1.6
        },
        '& ul, & ol': {
          paddingLeft: 3,
          margin: '0 0 0.9rem 0'
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'divider',
          margin: '0 0 1rem 0',
          paddingLeft: 1.5,
          color: 'text.secondary'
        },
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          backgroundColor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5
        },
        '& pre': {
          backgroundColor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 1.5,
          overflowX: 'auto'
        },
        '& hr': {
          border: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          my: 2
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
