import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography
} from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import LoadingState from '../components/ui/LoadingState'
import ErrorBanner from '../components/ui/ErrorBanner'
import MarkdownContent from '../components/ui/MarkdownContent'
import { ApiError } from '../api/client'
import { ContentPost, getContent } from '../api/content'
import { formatDate, formatDateTime } from '../utils/format'

export default function InsightDetailPage() {
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
        setError(apiErr.message || 'Unable to load insight')
      })
      .finally(() => setLoading(false))
  }, [idOrSlug])

  const chips = useMemo(() => {
    if (!post) return []
    const tagChips = (post.tags || []).map((tag) => ({ label: tag, variant: 'outlined' as const }))
    const symbolChips = (post.symbols || []).map((symbol) => ({ label: symbol, variant: 'outlined' as const }))
    const typeChip = {
      label: post.type === 'STRATEGY' ? 'Strategy' : 'Weekly plan',
      variant: 'filled' as const,
      color: 'primary' as const
    }
    return [typeChip, ...tagChips, ...symbolChips]
  }, [post])

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
          <Button key="back" component={Link} to="/insights" size="small">Insights</Button>,
          <Typography key="current" variant="body2">{post.title}</Typography>
        ]}
        actions={(
          <Button component={Link} to="/insights" variant="outlined">Back to Insights</Button>
        )}
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
            {post.type === 'WEEKLY_PLAN' && post.weekStart && post.weekEnd && (
              <Typography variant="body2" color="text.secondary">
                Week of {formatDate(post.weekStart)} – {formatDate(post.weekEnd)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Last updated {formatDateTime(post.updatedAt || post.publishedAt || '')}
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
        For journaling and educational purposes only. Not investment advice.
      </Alert>
    </Stack>
  )
}
