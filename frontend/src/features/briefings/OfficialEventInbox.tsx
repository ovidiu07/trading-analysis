import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { apiGet, apiPost } from '../../api/client'
import { useI18n } from '../../i18n'
import type { BriefingEvent } from './model'

type Event = { sourceId: 'BLS' | 'EUROSTAT' | 'EIA'; eventId: string; sourceEventId: string; identityBasis: string; name: string;
 scheduledAt?: string | null; scheduledDate: string; sourceTimezone: string; status: string; retrievedAt: string;
 sourceUrl: string; actual?: string | null; unit?: string | null; publishedAt?: string | null; measure?: string | null; referencePeriod?: string | null }
type Revision = { id: string; revision: number; previousId?: string | null; event: Event }
type Inbox = { suggestions: Revision[]; runs: { source_id: string; status: string; detail?: string; started_at: string }[];
 measures: { id: string; sourceId: string; label: string; unit: string }[] }

export default function OfficialEventInbox({ date, disabled, onUse }: { date: string; disabled: boolean; onUse: (event: BriefingEvent) => void }) {
 const { t } = useI18n()
 const [data, setData] = useState<Inbox>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
 const [selected, setSelected] = useState<string>(); const [history, setHistory] = useState<Revision[]>([])
 const [measure, setMeasure] = useState(''); const [period, setPeriod] = useState(''); const [publishedAt, setPublishedAt] = useState('')
 const [publicationSourceUrl, setPublicationSourceUrl] = useState(''); const [reviewed, setReviewed] = useState(false)
 const [previousId, setPreviousId] = useState('')
 const [importDate, setImportDate] = useState('')
 const generation = useRef(0); const useCurrent = useRef(onUse); useCurrent.current = onUse
 const row = data?.suggestions.find(r => r.id === selected)
 useEffect(() => {
   const scope = ++generation.current
   const controller = new AbortController(); setData(undefined); setSelected(undefined); setHistory([]); setError(''); setBusy(false); setImportDate('')
   apiGet<Inbox>(`/admin/official-events?date=${date}`, controller.signal).then(result => { if (generation.current === scope) setData(result) }).catch(e => { if (!controller.signal.aborted) setError(String(e)) })
   return () => { generation.current = scope + 1; controller.abort() }
 }, [date])
 async function action(work: (current: () => boolean) => Promise<unknown>) {
   const scope = generation.current; const current = () => scope === generation.current
   setBusy(true); setError('')
   try { await work(current); if (current()) { const result = await apiGet<Inbox>(`/admin/official-events?date=${date}`); if (current()) setData(result) } }
   catch(e) { if (current()) setError(String(e)) } finally { if (current()) setBusy(false) }
 }
 return <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', p: 1.5, borderRadius: 1 }}>
   <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 600 }}>{t('officialEvents.title')}</Box>
   <Stack spacing={1.5} sx={{ pt: 1 }}>
     <Alert severity="info">{t('officialEvents.reviewBoundary')}</Alert>
     <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{(['BLS', 'EUROSTAT'] as const).map(source => <Button key={source} disabled={busy || disabled} onClick={() => void action(() => apiPost(`/admin/official-events/refresh/${source}`, {}))}>{t('officialEvents.refresh')} {source}</Button>)}</Stack>
     <Button disabled={busy || disabled} onClick={() => void action(async current => { const result = await apiPost<{ date: string }>('/admin/official-events/refresh/EIA', {}); if (current()) setImportDate(result.date) })}>{t('officialEvents.fetchEia')}</Button>
     {importDate && <Alert severity="info">{t('officialEvents.importDate', { date: importDate })}</Alert>}
     {error ? <Alert severity="warning">{error}</Alert> : null}
     {!data?.suggestions.length ? <Typography>{t('officialEvents.empty')}</Typography> : data.suggestions.map(r => <Box key={r.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
       <Typography>{r.event.name} · {r.event.sourceId} · r{r.revision} · {t(`workstation.eventStatus.${r.event.status}`)}</Typography>
       <Typography variant="caption">{r.event.scheduledAt ?? `${r.event.scheduledDate} · ${t('officialEvents.timeUnavailable')}`} · {r.event.sourceTimezone} · {t('workstation.retrievedAt')}: {r.event.retrievedAt}</Typography>
       <Typography variant="caption" display="block">{r.id}</Typography>
       {r.event.actual != null ? <Typography>{r.event.measure} · {r.event.referencePeriod}: {r.event.actual} {r.event.unit} · {r.event.publishedAt}</Typography> : null}
       <Stack direction="row" spacing={1}><Button disabled={busy || disabled} onClick={() => { setSelected(r.id); setMeasure(''); setReviewed(false); setHistory([]) }}>{t('officialEvents.review')}</Button>
       <Button disabled={busy} onClick={() => void action(async current => { const result = await apiGet<Revision[]>(`/admin/official-events/${r.id}/history`); if (current()) setHistory(result) })}>{t('editorial.history')}</Button></Stack>
     </Box>)}
     {row ? <Stack spacing={1} sx={{ border: '1px solid', borderColor: 'primary.main', p: 1.5 }}>
       <Typography fontWeight={600}>{row.event.name} · r{row.revision}</Typography>
       <Typography component="a" href={row.event.sourceUrl} target="_blank" rel="noreferrer">{t('workstation.source')} · {row.event.sourceId}</Typography>
       <Typography variant="caption">{t('officialEvents.identityNote')} · {row.event.identityBasis} · {row.event.sourceEventId}</Typography>
       <Button disabled={busy || disabled} variant="outlined" onClick={() => void action(async current => { const result = await apiPost<BriefingEvent>(`/admin/official-events/${row.id}/review`, {}); if (current()) useCurrent.current(result) })}>{t('officialEvents.useReviewed')}</Button>
       {row.event.sourceId !== 'EIA' ? <>
       <Typography>{t('officialEvents.resultInstructions')}</Typography>
       <TextField select label={t('officialEvents.measure')} value={measure} onChange={e => { setMeasure(e.target.value); setReviewed(false) }}>{data?.measures.filter(m => m.sourceId === row.event.sourceId).map(m => <MenuItem key={m.id} value={m.id}>{m.label} · {m.unit}</MenuItem>)}</TextField>
       <TextField label={t('officialEvents.period')} placeholder="YYYY-MM" value={period} onChange={e => { setPeriod(e.target.value); setReviewed(false) }} />
       <TextField label={t('officialEvents.publicationTime')} placeholder="2026-09-25T12:30:00Z" value={publishedAt} onChange={e => { setPublishedAt(e.target.value); setReviewed(false) }} />
       <TextField label={t('officialEvents.publicationEvidence')} value={publicationSourceUrl} onChange={e => { setPublicationSourceUrl(e.target.value); setReviewed(false) }} />
       <FormControlLabel control={<Checkbox checked={reviewed} onChange={e => setReviewed(e.target.checked)} />} label={t('officialEvents.confirmPublication')} />
       <Button disabled={busy || disabled || !reviewed || !measure || !period || !publishedAt || !publicationSourceUrl || row.event.status === 'CANCELLED'} onClick={() => void action(() => apiPost(`/admin/official-events/${row.id}/result`, { measure, period, publishedAt, publicationSourceUrl, reviewedPublication: reviewed }))}>{t('officialEvents.fetchResult')}</Button></> : <Typography>{t('officialEvents.eiaBoundary')}</Typography>}
       <Typography>{t('officialEvents.linkInstructions')}</Typography>
       <TextField label={t('officialEvents.previousRevision')} value={previousId} onChange={e => setPreviousId(e.target.value)} />
       <Button disabled={busy || disabled || !previousId} onClick={() => void action(() => apiPost('/admin/official-events/link', { previousId, revisedId: row.id }))}>{t('officialEvents.linkReviewed')}</Button>
     </Stack> : null}
     {history.map(r => <Typography key={r.id} variant="caption">r{r.revision} · {r.event.name} · {r.event.scheduledAt ?? r.event.scheduledDate} · {r.event.status} · {r.event.actual ?? '—'} {r.event.unit} · {r.event.retrievedAt}</Typography>)}
     {data?.runs.slice(0, 4).map((run, i) => <Typography key={i} variant="caption">{run.source_id} · {run.status} · {run.started_at}{run.detail ? ` · ${run.detail}` : ''}</Typography>)}
   </Stack>
 </Box>
}
