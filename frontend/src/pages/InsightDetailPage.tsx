import { useEffect, useMemo, useState } from 'react'
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
import PageHeader from '../components/ui/PageHeader'
import LoadingState from '../components/ui/LoadingState'
import ErrorBanner from '../components/ui/ErrorBanner'
import MarkdownContent from '../components/ui/MarkdownContent'
import { ApiError } from '../api/client'
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
  const { t } = useI18n()
  const { idOrSlug } = useParams()
  const [post, setPost] = useState<ContentPost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!idOrSlug) return
    setLoading(true)
    setError('')
    getContent(idOrSlug)
      .then((data) => setPost(data))
      .catch((err) => {
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t))
      })
      .finally(() => setLoading(false))
  }, [idOrSlug])

  const chips = useMemo<ChipItem[]>(() => {
    if (!post) return []
    const tagChips: ChipItem[] = (post.tags || []).map((tag) => ({
      label: tag,
      variant: 'outlined',
      color: undefined
    }))
    const symbolChips: ChipItem[] = (post.symbols || []).map((symbol) => ({
      label: symbol,
      variant: 'outlined',
      color: undefined
    }))
    const typeChip: ChipItem = {
      label: post.contentTypeDisplayName || post.contentTypeKey,
      variant: 'filled',
      color: 'primary'
    }
    return [typeChip, ...tagChips, ...symbolChips]
  }, [post, t])

  if (loading && !post) {
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

  if (!post) {
    return null
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title={post.title}
        subtitle={post.summary || undefined}
        breadcrumbs={[
          <Button key="back" component={Link} to="/insights" size="small">{t('insights.title')}</Button>,
          <Typography key="current" variant="body2">{post.title}</Typography>
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
            {post.contentTypeKey === 'WEEKLY_PLAN' && post.weekStart && post.weekEnd && (
              <Typography variant="body2" color="text.secondary">
                {t('insights.weekOf')} {formatDate(post.weekStart)} - {formatDate(post.weekEnd)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('insightDetail.lastUpdated')} {formatDateTime(post.updatedAt || post.publishedAt || '')}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <MarkdownContent content={post.body} />
        </CardContent>
      </Card>

      <Alert severity="info">
        {t('insightDetail.infoAlert')}
      </Alert>
    </Stack>
  )
}
