import { Box } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { fetchAssetBlob, isProtectedApiUrl, resolveAssetUrl } from '../../api/assets'

type RichTextContentProps = {
  html?: string | null
}

const sanitizeRichHtml = (rawHtml: string) => {
  const doc = new DOMParser().parseFromString(rawHtml || '', 'text/html')
  const allowedTags = new Set([
    'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'H3', 'H4', 'IMG'
  ])
  const allowedAttrs: Record<string, string[]> = {
    IMG: ['src', 'alt', 'loading']
  }

  Array.from(doc.body.querySelectorAll('*')).forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const parent = element.parentNode
      if (!parent) return
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element)
      }
      parent.removeChild(element)
      return
    }
    Array.from(element.attributes).forEach((attr) => {
      const allowed = allowedAttrs[element.tagName]?.includes(attr.name)
      if (!allowed) {
        element.removeAttribute(attr.name)
      }
    })
    if (element.tagName === 'IMG') {
      const src = (element.getAttribute('src') || '').trim().toLowerCase()
      if (src.startsWith('javascript:')) {
        element.removeAttribute('src')
      }
      if (!element.getAttribute('loading')) {
        element.setAttribute('loading', 'lazy')
      }
    }
  })

  return doc.body.innerHTML
}

export default function RichTextContent({ html }: RichTextContentProps) {
  const sanitizedHtml = useMemo(() => sanitizeRichHtml(html || ''), [html])
  const [renderedHtml, setRenderedHtml] = useState(sanitizedHtml)

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    const resolveImages = async () => {
      setRenderedHtml(sanitizedHtml)
      if (!sanitizedHtml) return

      let parsed: Document
      try {
        parsed = new DOMParser().parseFromString(sanitizedHtml, 'text/html')
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
          if (cancelled) return
          const objectUrl = URL.createObjectURL(blob)
          objectUrls.push(objectUrl)
          node.setAttribute('src', objectUrl)
        } catch {
          node.setAttribute('src', resolvedSrc)
        }
      }))

      if (!cancelled) {
        setRenderedHtml(parsed.body.innerHTML || sanitizedHtml)
      }
    }

    void resolveImages()
    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [sanitizedHtml])

  return (
    <Box
      sx={{
        '& h3': {
          fontSize: '1rem',
          fontWeight: 700,
          mt: 1
        },
        '& h4': {
          fontSize: '0.95rem',
          fontWeight: 700,
          mt: 1
        },
        '& p': {
          my: 0.5
        },
        '& ul, & ol': {
          pl: 2.5,
          my: 0.5
        },
        '& li': {
          mb: 0.3
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'divider',
          pl: 1,
          ml: 0,
          color: 'text.secondary'
        },
        '& pre': {
          backgroundColor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          p: 1,
          overflowX: 'auto'
        },
        '& img': {
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          maxHeight: 320,
          objectFit: 'contain',
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          my: 1
        }
      }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}
