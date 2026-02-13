import { Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { ContentPost } from '../../api/content'
import { useI18n } from '../../i18n'

type StrategyCardProps = {
  item: ContentPost
  openPath: string
  onFollow?: (item: ContentPost) => void
  isFollowing?: boolean
}

const extractMarkets = (tags: string[]) => {
  const normalized = tags.map((item) => item.toUpperCase())
  const markets: string[] = []
  if (normalized.some((tag) => tag.includes('FOREX') || tag.includes('FX'))) markets.push('Forex')
  if (normalized.some((tag) => tag.includes('INDEX') || tag.includes('INDICE') || tag.includes('US100') || tag.includes('GER40'))) markets.push('Indices')
  return markets.length > 0 ? markets : ['Forex', 'Indices']
}

const extractSessions = (tags: string[]) => {
  const normalized = tags.map((item) => item.toUpperCase())
  const sessions: string[] = []
  if (normalized.some((tag) => tag.includes('LONDON'))) sessions.push('London')
  if (normalized.some((tag) => tag.includes('NEW YORK') || tag.includes('NY'))) sessions.push('NY')
  return sessions.length > 0 ? sessions : ['London', 'NY']
}

const extractDifficulty = (tags: string[]) => {
  const normalized = tags.join(' ').toUpperCase()
  if (normalized.includes('ADVANCED')) return 'Advanced'
  if (normalized.includes('INTERMEDIATE')) return 'Intermediate'
  return 'Beginner'
}

const extractSetup = (tags: string[]) => {
  const normalized = tags.map((item) => item.toUpperCase())
  if (normalized.some((tag) => tag.includes('SWEEP') && tag.includes('MSS'))) return 'Sweep + MSS'
  if (normalized.some((tag) => tag.includes('FVG'))) return 'FVG continuation'
  if (normalized.some((tag) => tag.includes('OB'))) return 'OB reversal'
  if (normalized.some((tag) => tag.includes('ORB'))) return 'ORB'
  return 'Playbook setup'
}

export default function StrategyCard({ item, openPath, onFollow, isFollowing = false }: StrategyCardProps) {
  const { t } = useI18n()
  const tags = item.tags || []
  const markets = extractMarkets(tags)
  const sessions = extractSessions(tags)
  const difficulty = extractDifficulty(tags)
  const setupType = extractSetup(tags)

  return (
    <Card sx={{ height: '100%', minWidth: 0 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
        <Stack spacing={1.25} sx={{ height: '100%' }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
            {item.title}
          </Typography>

          {item.summary && (
            <Typography variant="body2" color="text.secondary">
              {item.summary}
            </Typography>
          )}

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" color="primary" label={setupType} />
            <Chip size="small" variant="outlined" label={`${t('insights.strategy.difficulty')}: ${difficulty}`} />
            <Chip size="small" variant="outlined" label={`${t('insights.strategy.markets')}: ${markets.join(', ')}`} />
            <Chip size="small" variant="outlined" label={`${t('insights.strategy.sessions')}: ${sessions.join(', ')}`} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 'auto' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onFollow?.(item)}
              disabled={isFollowing}
            >
              {isFollowing ? t('insights.actions.following') : t('insights.actions.addToPlaybook')}
            </Button>
            <Button size="small" variant="outlined">{t('insights.actions.tagTrades')}</Button>
            <Button size="small" variant="contained" component={Link} to={openPath}>
              {t('insights.actions.openDetails')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
