import { Box, Skeleton, type SxProps, type Theme } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchAssetBlob, isProtectedApiUrl, resolveAssetUrl } from '../../api/assets'

type SecureAssetImageProps = {
  url?: string | null
  alt: string
  sx?: SxProps<Theme>
  fallback?: ReactNode
}

export default function SecureAssetImage({ url, alt, sx, fallback = null }: SecureAssetImageProps) {
  const resolvedUrl = useMemo(() => resolveAssetUrl(url), [url])
  const [src, setSrc] = useState('')
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!url) {
      setSrc('')
      setLoading(false)
      setFailed(false)
      return
    }

    const requiresAuthBlob = isProtectedApiUrl(url) || isProtectedApiUrl(resolvedUrl)
    if (!requiresAuthBlob) {
      setSrc(resolvedUrl)
      setLoading(false)
      setFailed(false)
      return
    }

    let cancelled = false
    let objectUrl = ''
    setLoading(true)
    setFailed(false)

    fetchAssetBlob(url)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [resolvedUrl, url])

  if (!url || failed) {
    return <>{fallback}</>
  }

  if (loading || !src) {
    return <Skeleton variant="rounded" width="100%" height={220} />
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={sx}
    />
  )
}
