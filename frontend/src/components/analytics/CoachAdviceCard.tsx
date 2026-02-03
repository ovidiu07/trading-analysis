import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material'
import type { AdviceCard, AdviceEvidence } from '../../api/analytics'
import { formatCurrency, formatNumber, formatPercent, formatSignedCurrency } from '../../utils/format'

type CoachAdviceCardProps = {
  card: AdviceCard
  currency: string
  onViewTrades?: (card: AdviceCard) => void
}

const severityColor = (severity: AdviceCard['severity']) => {
  switch (severity) {
    case 'critical':
      return 'error'
    case 'warn':
      return 'warning'
    default:
      return 'primary'
  }
}

const confidenceColor = (confidence: AdviceCard['confidence']) => {
  switch (confidence) {
    case 'high':
      return 'success'
    case 'medium':
      return 'info'
    default:
      return 'default'
  }
}

const formatEvidence = (evidence: AdviceEvidence, currency: string) => {
  if (evidence.value === null || evidence.value === undefined || Number.isNaN(evidence.value)) {
    return '—'
  }
  if (evidence.kind === 'currency') {
    return formatSignedCurrency(evidence.value, currency)
  }
  if (evidence.kind === 'percent') {
    return formatPercent(evidence.value)
  }
  return formatNumber(evidence.value)
}

export default function CoachAdviceCard({ card, currency, onViewTrades }: CoachAdviceCardProps) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" color={severityColor(card.severity)} label={card.severity.toUpperCase()} />
                <Chip size="small" color={confidenceColor(card.confidence)} label={`${card.confidence} confidence`} />
              </Stack>
            </Stack>
            {onViewTrades && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => onViewTrades(card)}
                sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, width: { xs: '100%', sm: 'auto' } }}
              >
                View trades
              </Button>
            )}
          </Stack>

          <Stack spacing={0.5}>
            {card.message.map((line, idx) => (
              <Stack key={`${card.id}-msg-${idx}`} direction="row" spacing={1} alignItems="flex-start">
                <Box component="span" sx={{ mt: '6px', width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">{line}</Typography>
              </Stack>
            ))}
          </Stack>

          {card.recommendedActions.length > 0 && (
            <>
              <Divider />
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" textTransform="uppercase">Recommended actions</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {card.recommendedActions.map((action) => (
                    <Chip key={`${card.id}-${action}`} size="small" label={action} />
                  ))}
                </Stack>
              </Stack>
            </>
          )}

          {card.evidence.length > 0 && (
            <>
              <Divider />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {card.evidence.map((item) => (
                  <Chip
                    key={`${card.id}-${item.label}`}
                    size="small"
                    variant="outlined"
                    label={`${item.label}: ${formatEvidence(item, currency)}`}
                  />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
