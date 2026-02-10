import { useEffect, useMemo, useState } from 'react'
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined'
import { Box, Skeleton, Stack, Typography } from '@mui/material'
import { fetchAssetBlob, isProtectedApiUrl, resolveAssetUrl } from '../../api/assets'

type AssetThumbnailProps = {
  url?: string | null
  alt: string
  onLoadError?: () => void
}

export default function AssetThumbnail({ url, alt, onLoadError }: AssetThumbnailProps) {
  const [src, setSrc] = useState('')
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const resolved = useMemo(() => resolveAssetUrl(url), [url])

  useEffect(() => {
    if (!url) {
      setSrc('')
      setFailed(false)
      setLoading(false)
      return
    }

    if (!isProtectedApiUrl(url)) {
      setSrc(resolved)
      setFailed(false)
      setLoading(false)
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
        setFailed(true)
        setLoading(false)
        onLoadError?.()
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [resolved, url, onLoadError])

  if (!url) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ width: 92, height: 64, borderRadius: 1.5, bgcolor: 'action.hover' }}
      >
        <BrokenImageOutlinedIcon fontSize="small" />
      </Stack>
    )
  }

  if (loading) {
    return <Skeleton variant="rounded" width={92} height={64} />
  }

  if (failed || !src) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={0.5}
        sx={{ width: 92, height: 64, borderRadius: 1.5, bgcolor: 'action.hover', px: 0.5 }}
      >
        <BrokenImageOutlinedIcon fontSize="small" />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1, textAlign: 'center' }}>
          Preview
        </Typography>
      </Stack>
    )
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        setFailed(true)
        onLoadError?.()
      }}
      sx={{
        width: 92,
        height: 64,
        borderRadius: 1.5,
        objectFit: 'cover',
        border: '1px solid',
        borderColor: 'divider'
      }}
    />
  )
}
