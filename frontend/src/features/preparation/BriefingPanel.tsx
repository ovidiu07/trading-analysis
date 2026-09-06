import { ContextFeed, Feed } from './ContextFeed'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { apiGet, apiPost } from '../../api/client'
import { Preparation } from '../../api/sessionReviews'
import { useI18n } from '../../i18n'
import { useEffect, useState } from 'react'

type Instrument = { latestAvailablePrice?: number; latestAvailableAt?: string; symbol: string; type: string; source: string; providerSymbol: string; status: string; reason?: string; dataDate?: string; observedUntil?: string; open?: number; high?: number; low?: number; close?: number; changeFromWindowOpen?: number; lower?: number; upper?: number; width?: number; percent?: number; observations?: number; sampleFrom?: string; sampleTo?: string; rangeStatus?: string }
type Briefing = { id: string; asOf: string; window: string; contextFeed?: Feed; instruments: Instrument[]; coach?: { cards?: { symbol: string; bias: string; rationale: string; primary: string; alternative: string; invalidation: string; risks: string }[] } }
export function BriefingPanel({ date, preparation: p, onVersion, coach = false }: { date: string; preparation: Preparation; onVersion: (id: string) => void; coach?: boolean }) {
  const { t } = useI18n()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const query = useQuery({ queryKey: ['preparationBriefing', date, p.briefingSession, p.briefingId],
    queryFn: () => p.briefingId ? apiGet<Briefing>(`/today/briefing/version/${p.briefingId}`) : apiPost<Briefing>(`/today/briefing/${date}?session=${p.briefingSession}`, {}), retry: false, staleTime: Infinity })
  useEffect(() => { if (query.data && !p.briefingId) onVersion(query.data.id) }, [query.data, p.briefingId, onVersion])
  const refresh = async () => {
    setRefreshing(true); setError(false)
    try { const next = await apiPost<Briefing>(`/today/briefing/${date}?session=${p.briefingSession}&refresh=true`, {}); onVersion(next.id) }
    catch { setError(true) } finally { setRefreshing(false) }
  }
  return <Stack spacing={1}>
    <Button disabled={refreshing || query.isLoading} onClick={() => void refresh()}>{t('prepare.refreshBriefing')}</Button>
    {(error || query.isError) && <Alert severity="warning">{t('prepare.unavailable')}</Alert>}
    {query.isLoading && <Typography role="status">{t('dailyReview.loading')}</Typography>}
    {query.data && <><Typography variant="caption">{t('prepare.reference')}: {query.data.asOf} · {query.data.window} · {query.data.id.slice(0,8)}</Typography>
      {!coach && <Stack component="ul" spacing={0.5} sx={{ pl: 2.5 }}>{query.data.instruments.filter(item => item.close != null).map(item => <Typography component="li" variant="body2" key={item.symbol}>{item.symbol} · {item.dataDate}: {t((item.changeFromWindowOpen ?? 0) > 0 ? 'prepare.bullish' : (item.changeFromWindowOpen ?? 0) < 0 ? 'prepare.bearish' : 'prepare.neutral')} · {t('prepare.observedRange')} {item.low}–{item.high}. {t('prepare.latestAvailable')}: {item.latestAvailablePrice} · {item.latestAvailableAt}</Typography>)}<Typography component="li" variant="body2">{t('prepare.observationScope')}</Typography></Stack>}
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' } }}>
      {query.data.instruments.map(item => <Card key={item.symbol} variant="outlined"><CardContent><Stack spacing={1}>
        <Typography variant="h6" component="h2">{item.symbol === 'GER40' ? 'DAX' : item.symbol === 'NAS100' ? 'NASDAQ-100' : 'ES'}</Typography>
        <Typography variant="caption">{item.symbol} · {item.providerSymbol} · {item.source} · {item.type}</Typography>
        <Typography variant="body2">{t('prepare.facts')} · {item.status}</Typography>
        {item.close != null ? <><Typography>{item.close} · Δ {item.changeFromWindowOpen?.toFixed(2)} {t('prepare.fromOpen')}</Typography><Typography variant="body2">{t('prepare.observedRange')}: {item.low}–{item.high}</Typography><Typography variant="caption">{item.dataDate} · {t('prepare.until')} {item.observedUntil}</Typography></> : <Typography>{t('prepare.noData')}: {item.reason}</Typography>}
        {coach && <><Typography>{query.data?.coach?.cards?.find(c => c.symbol === item.symbol)?.rationale || t('prepare.aiUnavailable')}</Typography>{query.data?.coach?.cards?.filter(c => c.symbol === item.symbol).map(c => <Stack key={c.symbol} spacing={1}><Typography>{t(`prepare.${c.bias}`)}</Typography>{(['primary','alternative','invalidation','risks'] as const).map(field => <Typography variant="body2" key={field}>{t(`prepare.${field}`)}: {c[field]}</Typography>)}</Stack>)}{item.rangeStatus === 'available' ? <><Typography>{t('prepare.estimatedRange')}: {item.lower?.toFixed(2)}–{item.upper?.toFixed(2)}</Typography><Typography variant="body2">{item.width?.toFixed(2)} pts · {item.percent?.toFixed(2)}% · n={item.observations}</Typography><Typography variant="caption">{t('prepare.rangeMethod')} · {item.sampleFrom}–{item.sampleTo} · {t('prepare.reference')}: {item.open}</Typography></> : <Typography variant="body2">{t('prepare.rangeUnavailable')}</Typography>}</>}
        <Typography variant="caption">{t('prepare.instrumentMismatch')}</Typography>
      </Stack></CardContent></Card>)}
      </Box>{!coach && <ContextFeed feed={query.data.contextFeed} />}</>}
  </Stack>
}
