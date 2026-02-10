import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  type ChipProps
} from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import AssetListRenderer from '../components/assets/AssetListRenderer'
import PageHeader from '../components/ui/PageHeader'
import LoadingState from '../components/ui/LoadingState'
import ErrorBanner from '../components/ui/ErrorBanner'
import MarkdownContent from '../components/ui/MarkdownContent'
import { ApiError } from '../api/client'
import { fetchAssetBlob, resolveAssetUrl } from '../api/assets'
import { ContentPost, getContent } from '../api/content'
import { formatDate, formatDateTime } from '../utils/format'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

type ChipItem = {
  label: string
  variant: 'outlined' | 'filled'
  color?: ChipProps['color']
}

export default function InsightDetailPage() {
  const { t, language } = useI18n()
  const { idOrSlug } = useParams()
  const [post, setPost] = useState<ContentPost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshAttempts, setRefreshAttempts] = useState(0)
  const translateRef = useRef(t)

  useEffect(() => {
    translateRef.current = t
  }, [t])

  const loadPost = useCallback(async () => {
    if (!idOrSlug) return
    setLoading(true)
    setError('')
    try {
      const data = await getContent(idOrSlug)
      setPost(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, translateRef.current))
    } finally {
      setLoading(false)
    }
  }, [idOrSlug])

  useEffect(() => {
    void loadPost()
  }, [loadPost])

  useEffect(() => {
    setRefreshAttempts(0)
  }, [idOrSlug])

  const localizedPost = useMemo<ContentPost | null>(() => {
    if (!post) return null
    const translation = post.translations?.[language]
    return {
      ...post,
      title: translation?.title || post.title,
      summary: translation?.summary ?? post.summary,
      body: translation?.body || post.body
    }
  }, [language, post])

  const chips = useMemo<ChipItem[]>(() => {
    if (!localizedPost) return []
    const tagChips: ChipItem[] = (localizedPost.tags || []).map((tag) => ({
      label: tag,
      variant: 'outlined',
      color: undefined
    }))
    const symbolChips: ChipItem[] = (localizedPost.symbols || []).map((symbol) => ({
      label: symbol,
      variant: 'outlined',
      color: undefined
    }))
    const typeChip: ChipItem = {
      label: localizedPost.contentTypeDisplayName || localizedPost.contentTypeKey,
      variant: 'filled',
      color: 'primary'
    }
    return [typeChip, ...tagChips, ...symbolChips]
  }, [localizedPost])

  const handleAttachmentImageError = () => {
    if (refreshAttempts >= 1 || loading) return
    setRefreshAttempts((prev) => prev + 1)
    void loadPost()
  }

  const handleDownloadAsset = async (asset: NonNullable<ContentPost['assets']>[number]) => {
    const targetUrl = asset.downloadUrl || asset.url || asset.viewUrl
    if (!targetUrl) return
    if (targetUrl.startsWith('/api/')) {
      try {
        const blob = await fetchAssetBlob(targetUrl)
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = asset.originalFileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      } catch (err) {
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t, 'insightDetail.errors.downloadFailed'))
      }
      return
    }
    window.open(resolveAssetUrl(targetUrl), '_blank', 'noopener,noreferrer')
  }

  if (loading && !localizedPost) {
    return (
      <Card>
        <CardContent>
          <LoadingState rows={4} height={32} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <ErrorBanner message={error} />
  }

  if (!localizedPost) {
    return null
  }

  const attachments = localizedPost.assets || []

  return (
    <Stack spacing={3}>
      <PageHeader
        title={localizedPost.title}
        subtitle={localizedPost.summary || undefined}
        breadcrumbs={[
          <Button key="back" component={Link} to="/insights" size="small">{t('insights.title')}</Button>,
          <Typography key="current" variant="body2">{localizedPost.title}</Typography>
        ]}
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {chips.map((chip, index) => (
                <Chip
                  key={`${chip.label}-${index}`}
                  label={chip.label}
                  size="small"
                  variant={chip.variant}
                  color={chip.color}
                />
              ))}
            </Stack>
            {localizedPost.contentTypeKey === 'WEEKLY_PLAN' && localizedPost.weekStart && localizedPost.weekEnd && (
              <Typography variant="body2" color="text.secondary">
                {t('insights.weekOf')} {formatDate(localizedPost.weekStart)} - {formatDate(localizedPost.weekEnd)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('insightDetail.lastUpdated')} {formatDateTime(localizedPost.updatedAt || localizedPost.publishedAt || '')}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <MarkdownContent content={localizedPost.body} />
        </CardContent>
      </Card>

      {attachments.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="h6">{t('insightDetail.attachments')}</Typography>
              <AssetListRenderer
                assets={attachments}
                emptyText={t('insightDetail.noAttachments')}
                onDownload={handleDownloadAsset}
                onImageError={handleAttachmentImageError}
                downloadLabel={t('common.download')}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      <Alert severity="info">
        {t('insightDetail.infoAlert')}
      </Alert>
    </Stack>
  )
}
