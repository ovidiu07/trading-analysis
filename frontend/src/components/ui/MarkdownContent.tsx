import { Box } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { convertMarkdownToHtml } from '../../utils/markdown'
import { fetchAssetBlob, isProtectedApiUrl, resolveAssetUrl } from '../../api/assets'

type MarkdownContentProps = {
  content?: string | null
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const html = useMemo(() => convertMarkdownToHtml(content || ''), [content])
  const [renderedHtml, setRenderedHtml] = useState(html)

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    const resolveImages = async () => {
      setRenderedHtml(html)
      if (!html) {
        return
      }

      let parsed: Document
      try {
        parsed = new DOMParser().parseFromString(html, 'text/html')
      } catch {
        return
      }

      const imageNodes = Array.from(parsed.querySelectorAll('img'))
      if (imageNodes.length === 0) {
        return
      }

      await Promise.all(imageNodes.map(async (node) => {
        const rawSrc = (node.getAttribute('src') || '').trim()
        if (!rawSrc) {
          return
        }

        const resolvedSrc = resolveAssetUrl(rawSrc) || rawSrc
        const requiresAuthenticatedFetch = isProtectedApiUrl(rawSrc) || isProtectedApiUrl(resolvedSrc)

        if (!requiresAuthenticatedFetch) {
          node.setAttribute('src', resolvedSrc)
          return
        }

        try {
          const blob = await fetchAssetBlob(rawSrc)
          if (cancelled) {
            return
          }
          const objectUrl = URL.createObjectURL(blob)
          objectUrls.push(objectUrl)
          node.setAttribute('src', objectUrl)
        } catch {
          node.setAttribute('src', resolvedSrc)
        }
      }))

      if (!cancelled) {
        setRenderedHtml(parsed.body.innerHTML || html)
      }
    }

    void resolveImages()

    return () => {
      cancelled = true
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [html])

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
          backgroundColor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
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
          textDecoration: 'underline',
          '&:hover': {
            color: 'primary.light'
          }
        },
        '& img': {
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          maxHeight: { xs: 320, sm: 420 },
          objectFit: 'contain',
          borderRadius: 12,
          border: '1px solid',
          borderColor: 'divider',
          margin: '0.9rem 0',
          backgroundColor: 'action.hover'
        }
      }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}
