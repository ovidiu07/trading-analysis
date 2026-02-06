import { Box } from '@mui/material'
import { useMemo } from 'react'
import { convertMarkdownToHtml } from '../../utils/markdown'

type MarkdownContentProps = {
  content?: string | null
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const html = useMemo(() => convertMarkdownToHtml(content || ''), [content])

  return (
    <Box
      sx={{
        '& h1': {
          fontSize: '1.9rem',
          fontWeight: 700,
          marginTop: 0
        },
        '& h2': {
          fontSize: '1.4rem',
          fontWeight: 700,
          marginTop: '1.4rem'
        },
        '& h3': {
          fontSize: '1.15rem',
          fontWeight: 700,
          marginTop: '1.1rem'
        },
        '& p': {
          margin: '0.85rem 0'
        },
        '& ul, & ol': {
          paddingLeft: '1.4rem',
          margin: '0.75rem 0'
        },
        '& li': {
          marginBottom: '0.35rem'
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'divider',
          marginLeft: 0,
          paddingLeft: '0.85rem',
          color: 'text.secondary',
          fontStyle: 'italic'
        },
        '& pre': {
          backgroundColor: 'rgba(15, 23, 42, 0.08)',
          padding: '0.85rem',
          borderRadius: 10,
          overflowX: 'auto'
        },
        '& code': {
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          fontSize: '0.85rem'
        },
        '& hr': {
          border: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          margin: '1.2rem 0'
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'underline'
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
