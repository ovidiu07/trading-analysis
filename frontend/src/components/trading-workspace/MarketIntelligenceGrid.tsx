import { useState, type ReactNode } from 'react'
import { Box, Chip, Link, Stack, Typography } from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import type { Preparation, ManualLevel } from '../../api/sessionReviews'
import type { AnalysisMetrics, InstrumentQuote, MacroObservation } from '../../api/marketData'
import { WorkstationCard } from './WorkspacePrimitives'
import OfficialReferenceCard from './OfficialReferenceCard'
import NewsEventsPanel from '../../features/news/NewsEventsPanel'
import { useI18n } from '../../i18n'

export default function MarketIntelligenceGrid({ preparation, thesis, briefing, onAcknowledge, acknowledgeLabel, date, selectedInstrument, macroObservations = [], isCurrentDate = false, displayTimezone = 'Europe/Bucharest', asOf }: {
  preparation: Preparation; thesis: string; briefing: ReactNode; onAcknowledge: (checked: boolean) => void; acknowledgeLabel: string; date: string; selectedInstrument: string
  quotes?: InstrumentQuote[]; macroObservations?: MacroObservation[]; analysis?: AnalysisMetrics | null; onManualLevelsChange?: (levels: ManualLevel[]) => void; isCurrentDate?: boolean; displayTimezone?: string; asOf?: string
}) {
  const { t } = useI18n()
  const [referencesOpen, setReferencesOpen] = useState(false)
  const references = isCurrentDate ? macroObservations.filter(item => ['US2Y', 'US10Y'].includes(item.canonicalInstrument) && item.provider === 'US_TREASURY' && item.provenance === 'OFFICIAL_PUBLIC' && item.priceBasis === 'OFFICIAL_DAILY_CLOSE' && item.unit === '%' && item.value != null && Number.isFinite(item.value) && item.observationDate && item.freshness !== 'UNAVAILABLE') : []
  return <Stack spacing={1.5} sx={{ minWidth: 0 }}>
    <WorkstationCard title={t('workstation.marketContext')} icon={ArticleOutlinedIcon}>
      {briefing}
      {thesis && <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="caption" color="text.secondary">{t('news.personalThesis')}</Typography>{preparation.bias !== 'neutral' && <Chip size="small" variant="outlined" label={t(`prepare.${preparation.bias}`)} />}</Stack>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>{thesis}</Typography>
      </Box>}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}><input type="checkbox" checked={preparation.contextAcknowledged} onChange={event => onAcknowledge(event.target.checked)} />{acknowledgeLabel}</label>
    </WorkstationCard>
    <NewsEventsPanel instrument={selectedInstrument} date={date} timezone={displayTimezone} isCurrentDate={isCurrentDate} asOf={asOf} />
    {references.length > 0 && <WorkstationCard title={t('workstation.crossMarket')} icon={QueryStatsRoundedIcon}>
      {references.map(item => <Box key={item.canonicalInstrument}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="caption">{t(`workstation.metrics.${item.canonicalInstrument.toLowerCase()}`)}</Typography><Typography variant="body2">{item.value!.toFixed(3)}%</Typography></Stack>
        <Typography variant="caption" color="text.secondary">{t('workstation.officialDailyReference')} · {item.observationDate}{item.freshness === 'STALE' ? ` · ${t('workstation.freshness.STALE')}` : ''}</Typography>
        {item.sourceUrl && <Link href={item.sourceUrl} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ ml: 1 }}>{t('workstation.source')}</Link>}
      </Box>)}
    </WorkstationCard>}
    {isCurrentDate && <Box component="details" onToggle={event => setReferencesOpen((event.target as HTMLDetailsElement).open)}>
      <Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.secondary', py: 0.5 }}>{t('news.referenceData')}</Box>
      {referencesOpen && <OfficialReferenceCard timezone={displayTimezone} />}
    </Box>}
  </Stack>
}
