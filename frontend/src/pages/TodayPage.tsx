import TradeReviewAssets from '../components/trades/TradeReviewAssets'
import { listNotebookNotes } from '../api/notebook'
import { fetchGrowthCoach } from '../api/growthCoach'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import { fetchAnalyticsCoach, AdviceCard } from '../api/analytics'
import CoachAdviceCard from '../components/analytics/CoachAdviceCard'
import FindingEvidenceDialog from '../components/analytics/FindingEvidenceDialog'
import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fromZonedTime } from 'date-fns-tz'
import { addDays, format } from 'date-fns'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { useAccountScope } from '../features/accountScope/useAccountScope'
import { selectedAccountsScope } from '../features/accountScope/accountScope'
import { searchTrades, TradeResponse } from '../api/trades'
import { listStrategies } from '../api/strategies'
import { emptyReview, getSessionReview, getSessionReviewHistory, saveSessionReview, SessionReview, ReviewState } from '../api/sessionReviews'
import { formatDateTime, formatSignedCurrency } from '../utils/format'
import { formatNetResult, netResult } from '../utils/tradeMoney'

export default function TodayPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const scope = useAccountScope()
  const [params] = useSearchParams()
  const account = scope.scope.mode === 'selected' && scope.scope.accountIds.length === 1
    ? scope.accounts.find(a => a.id === scope.scope.accountIds[0]) : undefined
  const timezone = account?.brokerTimezone || user?.timezone || 'Europe/Bucharest'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [date, setDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date')! : today)
  useEffect(() => {
    if (params.has('accountIds') || params.has('accountId') || params.has('accountScope') || !scope.accounts.length) return
    const remembered = localStorage.getItem(`today.account.${user?.id}`)
    const selected = scope.accounts.find(a => a.id === remembered) || scope.accounts.find(a => a.isDefault) || (scope.accounts.length === 1 ? scope.accounts[0] : undefined)
    if (selected) scope.setScope(selectedAccountsScope([selected.id]))
  }, [params, scope, user?.id])
  return <Stack spacing={2} sx={{ minWidth: 0 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField select label={t('dailyReview.account')} value={account?.id || ''} sx={{ minWidth: { sm: 240 } }} onChange={e => { scope.setScope(selectedAccountsScope([e.target.value])); localStorage.setItem(`today.account.${user?.id}`, e.target.value) }}>
        <MenuItem value="">{t('dailyReview.chooseAccount')}</MenuItem>
        {scope.accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name} · {a.currency || '—'}</MenuItem>)}
      </TextField>
      <TextField label={t('dailyReview.date')} type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }} InputLabelProps={{ shrink: true }} />
      <Chip label={timezone} sx={{ alignSelf: 'center' }} />
    </Stack>
    {scope.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}
    {!account ? <Alert severity="info">{t('dailyReview.chooseAccount')}</Alert> : <DailyWorkspace key={`${user?.id}:${account.id}:${date}`} accountId={account.id} date={date} timezone={timezone} broker={account.broker} />}
  </Stack>
}

function DailyWorkspace({ accountId, date, timezone: accountTimezone, broker }: { accountId: string; date: string; timezone: string; broker?: string | null }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const draftKey = `today.review.${user?.id}.${accountId}.${date}`
  const saved = useQuery({ queryKey: ['sessionReview', accountId, date], queryFn: () => getSessionReview(accountId, date) })
  const timezone = saved.data?.data.timezone || accountTimezone
  const [draft, setDraft] = useState<SessionReview>(emptyReview)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [conflictingDraft, setConflictingDraft] = useState<SessionReview | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'draft' | 'saving' | 'error'>('saved')
  const [chartExpanded, setChartExpanded] = useState(() => localStorage.getItem(`today.chart.${user?.id}`) === 'expanded')
  const [chartSymbol, setChartSymbol] = useState(() => localStorage.getItem(`today.chartSymbol.${user?.id}`) || '')
  const rules = useQuery({ queryKey: ['dailyRules', accountId, date], queryFn: () => fetchGrowthCoach(accountId, date.slice(0, 7), 'DAY', date) })
  const permission = rules.data?.detail?.operatingSystem?.tradingPermission
  const [showAllDecisions, setShowAllDecisions] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const notes = useQuery({ queryKey: ['dailyNotebookNotes', date], queryFn: () => listNotebookNotes({ from: date, to: date }), enabled: notesOpen })
  const [finding, setFinding] = useState<AdviceCard | null>(null)
  const observations = useQuery({ queryKey: ['dailyObservation', accountId, date], queryFn: () => fetchAnalyticsCoach({ accountIds: accountId, from: format(addDays(new Date(`${date}T12:00:00`), -30), 'yyyy-MM-dd'), to: date, dateMode: 'CLOSE' }) })
  const observation = observations.data?.advice.find(x => x.tradeIds && x.tradeIds.length >= 20 && x.id !== 'coach-data-quality')
  const [historyOpen, setHistoryOpen] = useState(false)
  const history = useQuery({ queryKey: ['sessionReviewHistory', accountId, date, revision], queryFn: () => getSessionReviewHistory(accountId, date), enabled: historyOpen })
  const [selected, setSelected] = useState<TradeResponse | null>(null)
  const strategies = useQuery({ queryKey: ['strategies', 'dailyReview'], queryFn: () => listStrategies() })
  const executions = useQuery({ queryKey: ['sessionExecutions', accountId, date, timezone], queryFn: async () => {
    const start = fromZonedTime(`${date}T00:00:00`, timezone).toISOString()
    const nextDate = format(addDays(new Date(`${date}T12:00:00`), 1), 'yyyy-MM-dd')
    const end = new Date(fromZonedTime(`${nextDate}T00:00:00`, timezone).getTime() - 1).toISOString()
    async function all(filters: Parameters<typeof searchTrades>[0]) {
      const result: TradeResponse[] = []
      let page = 0
      while (true) { const response = await searchTrades({ ...filters, accountIds: accountId, size: 100, page }); result.push(...response.content); if (page + 1 >= response.totalPages) break; page++ }
      return result
    }
    const [closed, open] = await Promise.all([all({ closedDate: date, tz: timezone, status: 'CLOSED' }), all({ openedAtFrom: start, openedAtTo: end, status: 'OPEN' })])
    return [...closed, ...open].sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  } })
  useEffect(() => {
    if (!saved.data || ready) return
    let recovered: { revision: number; data: SessionReview } | null = null
    try { recovered = JSON.parse(localStorage.getItem(draftKey) || 'null') } catch { /* Retain server state when local storage is invalid. */ }
    setRevision(saved.data.revision)
    if (recovered && recovered.revision === saved.data.revision) { setDraft({ ...emptyReview, ...recovered.data }); setSaveState('draft') }
    else { setDraft({ ...emptyReview, ...saved.data.data }); if (recovered) { setConflictingDraft(recovered.data); setSaveState('error') } }
    setReady(true)
  }, [saved.data, ready, draftKey])
  const update = (patch: Partial<SessionReview>) => {
    const next = { ...draft, ...patch }; setDraft(next); setSaveState('draft')
    try { localStorage.setItem(draftKey, JSON.stringify({ revision, data: next })) } catch { setSaveState('error') }
  }
  const save = async (state: ReviewState = draft.state) => {
    const next = { ...draft, state }; setDraft(next); setSaveState('saving')
    try {
      localStorage.setItem(draftKey, JSON.stringify({ revision, data: next }))
      const result = await saveSessionReview(accountId, date, revision, next)
      setRevision(result.revision); setDraft({ ...emptyReview, ...result.data }); setSaveState('saved'); localStorage.removeItem(draftKey)
    } catch { setSaveState('error') }
  }
  const importedWorkflow = /trading[ _-]?212|mt5|metatrader|tradovate/i.test(broker || '')
  const trades = executions.data || []
  const closed = trades.filter(x => x.status === 'CLOSED')
  const money = closed.map(netResult)
  const currency = money[0]?.currency
  const knownMoney = money.length > 0 && money.every(x => x.value != null && x.currency && x.currency === currency)
  const total = knownMoney ? money.reduce((sum, x) => sum + x.value!, 0) : null
  const strategy = strategies.data?.myStrategies.find(x => x.id === draft.strategyId)
  const scoped = (path: string, extra = '') => `${path}?accountIds=${encodeURIComponent(accountId)}${extra}`
  const reviewed = closed.filter(x => draft.assessments.some(a => a.tradeId === x.id)).length
  const queue = draft.state === 'REVIEW' && !showAllDecisions ? [...closed].sort((a, b) => Number(draft.assessments.some(x => x.tradeId === a.id)) - Number(draft.assessments.some(x => x.tradeId === b.id))).slice(0, 8) : trades
  const assessment = selected ? draft.assessments.find(x => x.tradeId === selected.id) : undefined
  const assess = (decision: 'FOLLOWED' | 'DEVIATED' | 'CANNOT_ASSESS', note = assessment?.note || '') => {
    if (!selected) return
    update({ assessments: [...draft.assessments.filter(x => x.tradeId !== selected.id), { tradeId: selected.id, decision, note }] })
  }
  if (saved.isError) return <Alert severity="error" action={<Button onClick={() => void saved.refetch()}>{t('dailyReview.retry')}</Button>}>{t('dailyReview.loadError')}</Alert>
  if (!ready) return <Typography role="status">{t('dailyReview.loading')}</Typography>
  return <Stack component="fieldset" disabled={saveState === 'saving'} spacing={2} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {(['PREPARE', 'TRADE', 'REVIEW'] as const).map(state => <Button key={state} variant={draft.state === state ? 'contained' : 'outlined'} disabled={saveState === 'saving'} onClick={() => update({ state })}>{t(`dailyReview.states.${state}`)}</Button>)}
      <Chip role="status" label={t(`dailyReview.save.${saveState}`)} />
    </Stack>
    {saveState === 'error' && <Alert severity="error">{t('dailyReview.saveError')}</Alert>}
    {conflictingDraft && <Card><CardContent><Stack spacing={1}><Typography>{t('dailyReview.conflictRecovery')}</Typography><Typography variant='body2'>{t('dailyReview.focus')}: {conflictingDraft.focus}</Typography><Typography variant='body2'>{t('dailyReview.nextFocus')}: {conflictingDraft.nextFocus}</Typography><Button onClick={() => { update(conflictingDraft); setConflictingDraft(null) }}>{t('dailyReview.restoreDraft')}</Button></Stack></CardContent></Card>}
    {executions.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      {[['net', knownMoney ? formatSignedCurrency(total, currency!) : '—'], ['closed', String(closed.length)], ['reviewed', `${reviewed}/${closed.length}`]].map(([key, value]) => <Card key={key}><CardContent sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">{t(`dailyReview.${key}`)}</Typography><Typography className="metric-value">{executions.isLoading ? '…' : value}</Typography></CardContent></Card>)}
    </Box>
    <Typography variant="caption" color="text.secondary">{t('dailyReview.freshness', { time: executions.dataUpdatedAt ? formatDateTime(new Date(executions.dataUpdatedAt).toISOString(), timezone) : '—' })} · {timezone}</Typography>
    {closed.length > 0 && !knownMoney && <Alert severity="info">{t('dailyReview.moneyUnavailable')}</Alert>}
    <Button onClick={() => { setChartExpanded(!chartExpanded); localStorage.setItem(`today.chart.${user?.id}`, chartExpanded ? 'compact' : 'expanded') }}>{t(chartExpanded ? 'dailyReview.compactMode' : 'dailyReview.chartMode')}</Button>
    {chartExpanded && <Card><CardContent><Stack spacing={1}><TextField label={t('dailyReview.chartSymbol')} value={chartSymbol} onChange={e => { setChartSymbol(e.target.value); localStorage.setItem(`today.chartSymbol.${user?.id}`, e.target.value) }} /><Typography variant='caption'>{t('dailyReview.chartContext', { symbol: chartSymbol || '—' })}</Typography>{chartSymbol && <TradingViewWidget symbol={chartSymbol} minHeight={360} fallbackMessage={t('today.session.mentor.liveChartFallback')} fallbackLinkLabel={t('today.session.mentor.openOnTradingView')} />}</Stack></CardContent></Card>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
      <Card><CardContent><Stack spacing={2}>
        {draft.state === 'PREPARE' && <>
          <TextField label={t('dailyReview.instruments')} value={draft.instruments} onChange={e => update({ instruments: e.target.value })} />
          <TextField select label={t('dailyReview.strategy')} value={draft.strategyId || ''} onChange={e => update({ strategyId: e.target.value || null, strategyContext: undefined })}><MenuItem value="">{t('dailyReview.noStrategy')}</MenuItem>{strategies.data?.myStrategies.filter(x => !x.archived || x.id === draft.strategyId).map(x => <MenuItem value={x.id} key={x.id}>{x.name}</MenuItem>)}</TextField>
          <TextField label={t('dailyReview.focus')} multiline minRows={2} value={draft.focus} onChange={e => update({ focus: e.target.value })} />
          <Button variant="contained" disabled={saveState === 'saving'} onClick={() => void save('TRADE')}>{t('dailyReview.start')}</Button>
        </>}
        {(draft.state === 'TRADE' || draft.state === 'REVIEW') && <>
          <Typography component="h2" variant="h6">{t(draft.state === 'TRADE' ? 'dailyReview.timeline' : 'dailyReview.decisions')}</Typography>
          {draft.state === 'TRADE' && <><Button component={Link} variant="contained" to={scoped('/trades', importedWorkflow ? '&import=1' : '&quickLog=1')}>{t(importedWorkflow ? 'dailyReview.import' : 'dailyReview.log')}</Button><Button component={Link} to={scoped('/trades', importedWorkflow ? '&quickLog=1' : '&import=1')}>{t(importedWorkflow ? 'dailyReview.log' : 'dailyReview.import')}</Button></>}
          {!trades.length && <Typography color="text.secondary">{t('dailyReview.noTrades')}</Typography>}
          {queue.map(trade => <Button key={trade.id} variant="outlined" sx={{ justifyContent: 'space-between', textAlign: 'left', gap: 1, flexWrap: 'wrap' }} onClick={() => setSelected(trade)}><span>{trade.symbol} · {t(`trades.direction.${trade.direction}`)}<br />{formatDateTime(trade.openedAt, timezone)}</span><span>{t(`dailyReview.${trade.status}`)} · {formatNetResult(trade)}<br />{t(draft.assessments.some(a => a.tradeId === trade.id) ? 'dailyReview.assessed' : 'dailyReview.reviewTrade')}</span></Button>)}
          {draft.state === 'REVIEW' && closed.length > 8 && <Button onClick={() => setShowAllDecisions(!showAllDecisions)}>{t(showAllDecisions ? 'dailyReview.shortQueue' : 'dailyReview.allDecisions')}</Button>}
          {draft.state === 'REVIEW' && <>
            <TextField select label={t('dailyReview.carryForward')} value={draft.carryForward || ''} onChange={e => update({ carryForward: e.target.value as SessionReview['carryForward'] })}><MenuItem value="">—</MenuItem>{['REPEAT', 'CHANGE', 'COLLECT'].map(x => <MenuItem key={x} value={x}>{t(`dailyReview.carry.${x}`)}</MenuItem>)}</TextField>
            <TextField label={t('dailyReview.nextFocus')} value={draft.nextFocus} multiline minRows={2} onChange={e => update({ nextFocus: e.target.value })} />
            <Button variant="contained" disabled={!draft.carryForward || saveState === 'saving' || executions.isLoading || executions.isError} onClick={() => void save('COMPLETE')}>{t('dailyReview.finish')}</Button>
          </>}
        </>}
        {draft.state === 'COMPLETE' && <><Alert severity="success">{t('dailyReview.complete')}</Alert><Typography>{draft.nextFocus || t('dailyReview.carry.COLLECT')}</Typography><Button onClick={() => void save('REVIEW')}>{t('dailyReview.reopen')}</Button></>}
        {draft.state !== 'COMPLETE' && <Button disabled={saveState === 'saving'} onClick={() => void save()}>{t('dailyReview.saveDraft')}</Button>}
      </Stack></CardContent></Card>
      <Stack spacing={2}><Card><CardContent><Stack spacing={1}><Typography component="h2" variant="h6">{t('dailyReview.context')}</Typography>
        <Typography>{draft.focus || t('dailyReview.noFocus')}</Typography>
        {strategy && <><Typography fontWeight={700}>{draft.strategyContext?.name ?? strategy.name}</Typography><Typography variant="body2">{draft.strategyContext ? draft.strategyContext.entry?.replace(/<[^>]*>/g, ' ') : strategy.entryConditions.join(' · ')}</Typography><Typography variant="body2">{t('dailyReview.invalidation')}: {draft.strategyContext?.invalidation ?? strategy.invalidationLogic}</Typography><Typography variant="body2">{t('dailyReview.noTrade')}: {draft.strategyContext ? draft.strategyContext.noTrade : strategy.noTradeRules || '—'}</Typography></>}
        {permission ? <Alert severity={permission.maximumPermittedRisk === 0 ? 'warning' : 'info'}><Typography variant='body2'>{t('dailyReview.capacity', { trades: permission.remainingTrades ?? '—', risk: permission.maximumPermittedRisk == null ? '—' : formatSignedCurrency(permission.maximumPermittedRisk, rules.data!.detail!.account.currency) })}</Typography><Typography variant='caption'>{t(permission.primaryReason)}</Typography></Alert> : <Typography variant='body2'>{t('dailyReview.rulesUnavailable')}</Typography>}
        <Typography variant='caption'>{t('dailyReview.ruleGuidance')}</Typography>
        <Button component={Link} to={scoped('/coach')}>{t('dailyReview.rules')}</Button><Button component={Link} to={scoped('/today/session')}>{t('dailyReview.chart')}</Button><Button component={Link} to={scoped('/notebook', `&date=${date}`)}>{t('dailyReview.notes')}</Button>
      </Stack></CardContent></Card>{observation ? <CoachAdviceCard card={observation} currency={observation.currency || ''} onViewTrades={setFinding} /> : <Alert severity='info'>{t('dailyReview.noObservation')}</Alert>}<Button component={Link} to={scoped('/analytics')}>{t('dailyReview.reviewEvidence')}</Button></Stack>
    </Box>
    <Button onClick={() => setNotesOpen(!notesOpen)}>{t('dailyReview.dayNotes')}</Button>
    {notesOpen && <Card><CardContent><Stack spacing={1}><Typography variant="caption">{t('dailyReview.dayNotesScope')}</Typography>{notes.isLoading && <Typography>{t('dailyReview.loading')}</Typography>}{notes.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}{notes.data?.filter(note => !note.isDeleted && (!note.relatedTradeId || trades.some(trade => trade.id === note.relatedTradeId))).map(note => <Button key={note.id} component={Link} to={scoped('/notebook', `&noteId=${encodeURIComponent(note.id)}`)}>{note.title || t('notebook.defaultTitle.untitledNote')}</Button>)}<Button component={Link} to={scoped('/notebook', `&date=${date}`)}>{t('dailyReview.notes')}</Button></Stack></CardContent></Card>}
    <Button onClick={() => setHistoryOpen(true)}>{t('dailyReview.history')}</Button>
    <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{t('dailyReview.history')}</DialogTitle><DialogContent><Stack spacing={2}>
      <Typography variant="caption">{t('dailyReview.historyLimit')}</Typography>
      {history.isLoading && <Typography>{t('dailyReview.loading')}</Typography>}
      {history.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}
      {history.data?.map(item => <Card key={item.revision}><CardContent><Typography>{t('dailyReview.revision', { revision: item.revision })} · {item.data.state === 'COMPLETE' ? t('dailyReview.complete') : t(`dailyReview.states.${item.data.state}`)}</Typography><Typography variant="caption">{item.data.savedAt && formatDateTime(item.data.savedAt, timezone)}</Typography><Typography>{item.data.focus}</Typography><Typography>{item.data.nextFocus}</Typography>{item.data.assessments?.map(a => <Typography variant="body2" key={a.tradeId}>{t(`dailyReview.assessment.${a.decision}`)} · {a.note}</Typography>)}</CardContent></Card>)}
    </Stack></DialogContent><DialogActions><Button onClick={() => setHistoryOpen(false)}>{t('common.close')}</Button></DialogActions></Dialog>
    <FindingEvidenceDialog finding={finding} onClose={() => setFinding(null)} />
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm"><DialogTitle>{selected?.symbol} · {t('dailyReview.reviewTrade')}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography>{selected && formatNetResult(selected)}</Typography><Alert severity="info">{t('dailyReview.contextBasis')}</Alert>
      <ToggleButtonGroup exclusive value={assessment?.decision || null} onChange={(_, value) => { if (value) assess(value) }} sx={{ flexWrap: 'wrap' }}>{['FOLLOWED', 'DEVIATED', 'CANNOT_ASSESS'].map(x => <ToggleButton key={x} value={x}>{t(`dailyReview.assessment.${x}`)}</ToggleButton>)}</ToggleButtonGroup>
      <TextField label={t('dailyReview.note')} multiline minRows={3} value={assessment?.note || ''} onChange={e => assess(assessment?.decision || 'CANNOT_ASSESS', e.target.value)} />
      {selected && <TradeReviewAssets key={selected.id} tradeId={selected.id} />}
      <Button component={Link} to={scoped('/trades', `&tradeId=${selected?.id}`)}>{t('dailyReview.fullTrade')}</Button>
    </Stack></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>{t('common.close')}</Button><Button disabled={saveState === 'saving'} onClick={() => void save()}>{t('dailyReview.saveDraft')}</Button></DialogActions></Dialog>
  </Stack>
}
