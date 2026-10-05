import { Box, Stack, Typography } from '@mui/material'
import { useI18n } from '../../i18n'
import type { TradePreparationSnapshot } from './tradePreparationSnapshot'

const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
function Configuration({ value }: { value: unknown }) {
  if (value == null) return <Typography variant="caption">—</Typography>
  if (typeof value !== 'object') return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{typeof value === 'boolean' ? (value ? '✓' : '—') : String(value)}</Typography>
  return <Stack spacing={0.6} sx={{ pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
    {Object.entries(value).map(([key, item]) => item && typeof item === 'object'
      ? <Box component="details" key={key}><Box component="summary" sx={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: 13 }}>{label(key)}</Box><Configuration value={item} /></Box>
      : <Box key={key}><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{label(key)}</Typography><Configuration value={item} /></Box>)}
  </Stack>
}
export default function TradePreparationRecord({ snapshot }: { snapshot?: TradePreparationSnapshot | null }) {
  const { t } = useI18n()
  if (!snapshot) return null
  const p = snapshot.review?.preparation
  return <Box component="section" aria-label={t('chartPlan.savedPlan')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, my: 1 }}>
    <Stack spacing={1}>
      <Typography variant="subtitle2" fontWeight={700}>{t('chartPlan.savedPlan')}</Typography>
      <Typography variant="caption" color="text.secondary">{t('chartPlan.snapshotBoundary')} {snapshot.capturedAt}</Typography>
      <Typography variant="body2">{snapshot.date} · {snapshot.session} · {snapshot.timezone}</Typography>
      {snapshot.review?.focus && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{snapshot.review.focus}</Typography>}
      {p?.chartPlan && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{p.chartPlan}</Typography>}
      {p?.emotion && <Typography variant="body2">{t('workstation.psychology')}: {t(`workstation.emotions.${p.emotion}`)}</Typography>}
      {p?.psychologyNotes && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{p.psychologyNotes}</Typography>}
      {p?.sessionNotes && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{p.sessionNotes}</Typography>}
      {p?.checklistLabels?.map((text, i) => <Typography key={i} variant="body2">{p.checklist[i] ? '✓' : '—'} {text}</Typography>)}
      <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', fontSize: 13 }}>{t('chartPlan.configuration')}</Box><Configuration value={snapshot} /></Box>
    </Stack>
  </Box>
}
