import { Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { ContentPost } from '../../api/content'
import { formatDate, formatDateTime } from '../../utils/format'
import { useI18n } from '../../i18n'

type ContentCardProps = {
  item: ContentPost
  displayTypeLabel: string
  openPath: string
  onFollow?: (item: ContentPost) => void
  isFollowing?: boolean
}

const chipSx = {
  maxWidth: '100%',
  '& .MuiChip-label': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
} as const

export default function ContentCard({ item, displayTypeLabel, openPath, onFollow, isFollowing = false }: ContentCardProps) {
  const { t } = useI18n()

  const tags = item.tags || []
  const symbols = item.symbols || []
  const visibleTags = tags.slice(0, 2)
  const visibleSymbols = symbols.slice(0, 2)
  const hiddenCount = Math.max(tags.length - visibleTags.length, 0) + Math.max(symbols.length - visibleSymbols.length, 0)

  return (
    <Card sx={{ height: '100%', minWidth: 0, overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
        <Stack spacing={1.5} sx={{ minWidth: 0, height: '100%' }}>
          <Stack spacing={0.75}>
            <Typography component="h2" variant="h6" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {item.title}
            </Typography>
            {item.summary && (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {item.summary}
              </Typography>
            )}
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ minWidth: 0 }}>
            <Chip label={displayTypeLabel} size="small" color="primary" sx={chipSx} />
            {visibleTags.map((tag) => (
              <Chip key={`${item.id}-${tag}`} label={tag} size="small" variant="outlined" sx={chipSx} />
            ))}
            {visibleSymbols.map((symbol) => (
              <Chip key={`${item.id}-${symbol}`} label={symbol} size="small" variant="outlined" sx={chipSx} />
            ))}
            {hiddenCount > 0 && <Chip label={`+${hiddenCount}`} size="small" variant="outlined" sx={chipSx} />}
          </Stack>

          {item.contentTypeKey === 'WEEKLY_PLAN' && item.weekStart && item.weekEnd && (
            <Typography variant="body2" color="text.secondary">
              {t('insights.weekOf')} {formatDate(item.weekStart)} - {formatDate(item.weekEnd)}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            {t('insights.updated')} {formatDateTime(item.updatedAt || item.publishedAt || '')}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 'auto' }}>
            <Button size="small" variant="outlined">
              {t('insights.actions.save')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onFollow?.(item)}
              disabled={isFollowing}
            >
              {isFollowing ? t('insights.actions.following') : t('insights.actions.follow')}
            </Button>
            <Button
              size="small"
              variant="contained"
              component={Link}
              to={openPath}
              aria-label={`${t('insights.actions.open')}: ${item.title}`}
            >
              {t('insights.actions.open')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
