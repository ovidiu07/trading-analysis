import { apiGet } from '../api/client'
import { LogSessionTrade } from '../features/preparation/LogSessionTrade'
import { SessionJournal } from '../features/preparation/SessionJournal'
import { PrepareSteps } from '../features/preparation/PrepareSteps'
import { initialPreparation, strategyText } from '../features/preparation/context'
import TradeReviewAssets from '../components/trades/TradeReviewAssets'
import { listNotebookNotes } from '../api/notebook'
import { fetchGrowthCoach } from '../api/growthCoach'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import { fetchAnalyticsCoach, AdviceCard } from '../api/analytics'
import CoachAdviceCard from '../components/analytics/CoachAdviceCard'
import FindingEvidenceDialog from '../components/analytics/FindingEvidenceDialog'
import { useEffect, useState, useRef } from 'react'
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
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
  const [session, setSession] = useState(() => sessionStorage.getItem('today.session') || 'DAY')
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
      <TextField select label={t('prepare.workspace')} value={session} onChange={e => { setSession(e.target.value); sessionStorage.setItem('today.session', e.target.value) }}>
        {['DAY', 'EUROPE', 'US'].map(value => <MenuItem value={value} key={value}>{t(`prepare.sessions.${value}`)}</MenuItem>)}
      </TextField>
      <Chip label={timezone} sx={{ alignSelf: 'center' }} />
    </Stack>
    {scope.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}
    {!account ? <Alert severity="info">{t('dailyReview.chooseAccount')}</Alert> : <DailyWorkspace key={`${user?.id}:${account.id}:${date}:${session}`} session={session} accountId={account.id} date={date} timezone={timezone} broker={account.broker} />}
  </Stack>
}

function DailyWorkspace({ accountId, date, session, timezone: accountTimezone, broker }: { session: string; accountId: string; date: string; timezone: string; broker?: string | null }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const draftKey = `today.review.${user?.id}.${accountId}.${date}.${session}`
  const saved = useQuery({ queryKey: ['sessionReview', accountId, date, session], queryFn: () => getSessionReview(accountId, date, session) })
  const timezone = saved.data?.data.timezone || accountTimezone
  const [draft, setDraft] = useState<SessionReview>(() => ({ ...emptyReview, preparation: initialPreparation() }))
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [conflictingDraft, setConflictingDraft] = useState<SessionReview | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'draft' | 'saving' | 'error'>('saved')
  const [chartExpanded, setChartExpanded] = useState(() => localStorage.getItem(`today.chart.${user?.id}`) === 'expanded')
  const rules = useQuery({ queryKey: ['dailyRules', accountId, date], queryFn: () => fetchGrowthCoach(accountId, date.slice(0, 7), 'DAY', date) })
  const permission = rules.data?.detail?.operatingSystem?.tradingPermission
  const [showAllDecisions, setShowAllDecisions] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const notes = useQuery({ queryKey: ['dailyNotebookNotes', date], queryFn: () => listNotebookNotes({ from: date, to: date }), enabled: notesOpen })
  const [finding, setFinding] = useState<AdviceCard | null>(null)
  const observations = useQuery({ queryKey: ['dailyObservation', accountId, date], queryFn: () => fetchAnalyticsCoach({ accountIds: accountId, from: format(addDays(new Date(`${date}T12:00:00`), -30), 'yyyy-MM-dd'), to: date, dateMode: 'CLOSE' }) })
  const observation = observations.data?.advice.find(x => x.tradeIds && x.tradeIds.length >= 20 && x.id !== 'coach-data-quality')
  const [historyOpen, setHistoryOpen] = useState(false)
  const history = useQuery({ queryKey: ['sessionReviewHistory', accountId, date, session, revision], queryFn: () => getSessionReviewHistory(accountId, date, session), enabled: historyOpen })
  const [selected, setSelected] = useState<TradeResponse | null>(null)
  const executionContext = useQuery({ queryKey: ['executionPreparation', selected?.id], queryFn: () => apiGet<SessionReview>(`/today/log-trade/context/${selected!.id}`), enabled: Boolean(selected) })
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
    if (recovered && recovered.revision === saved.data.revision) { setDraft({ ...emptyReview, preparation: initialPreparation(), ...recovered.data }); setSaveState('draft') }
    else { setDraft({ ...emptyReview, preparation: initialPreparation(), ...saved.data.data }); if (recovered) { setConflictingDraft(recovered.data); setSaveState('error') } }
    setReady(true)
  }, [saved.data, ready, draftKey])
  const editSequence = useRef(0)
  const latestDraft = useRef(draft)
  latestDraft.current = draft
  const update = (patch: Partial<SessionReview>) => {
    editSequence.current++
    const next = { ...latestDraft.current, ...patch }; latestDraft.current = next; setDraft(next); setSaveState('draft')
    try { localStorage.setItem(draftKey, JSON.stringify({ revision, data: next })) } catch { setSaveState('error') }
  }
  const savingRef = useRef(false)
  const save = async (state: ReviewState = draft.state) => {
    if (savingRef.current) return
    savingRef.current = true
    const sequence = editSequence.current
    const next = { ...draft, state }; setDraft(next); setSaveState('saving')
    try {
      localStorage.setItem(draftKey, JSON.stringify({ revision, data: next }))
      const result = await saveSessionReview(accountId, date, revision, next, session)
      setRevision(result.revision)
      if (sequence === editSequence.current) { setDraft({ ...emptyReview, ...result.data }); setSaveState('saved'); const retained = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (JSON.stringify(retained?.data) === JSON.stringify(next)) localStorage.removeItem(draftKey) }
      else { setSaveState('draft'); localStorage.setItem(draftKey, JSON.stringify({ revision: result.revision, data: latestDraft.current })) }
    } catch { setSaveState('error') } finally { savingRef.current = false }
  }
  const saveLatest = useRef(save)
  saveLatest.current = save
  useEffect(() => {
    if (!ready || saveState !== 'draft' || conflictingDraft) return
    const timer = window.setTimeout(() => void saveLatest.current(), 900)
    return () => window.clearTimeout(timer)
  }, [draft, ready, saveState, conflictingDraft])
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
  const prep = draft.preparation || initialPreparation()
  const chart = <Card><CardContent><Stack spacing={1}>
    <Autocomplete multiple freeSolo options={['DAX', 'NASDAQ-100', 'ES']} value={draft.instruments.split(',').map(value => value.trim()).filter(Boolean)} onChange={(_, values) => update({ instruments: [...new Set(values)].join(', ') })} renderInput={params => <TextField {...params} label={t('dailyReview.instruments')} />} />
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>{[['DAX · CFD', 'OANDA:DE30EUR'], ['NASDAQ-100 · CFD', 'OANDA:NAS100USD'], ['ES · Futures', 'CME_MINI:ES1!']].map(([label, symbol]) => <Button key={symbol} variant={prep.chartSymbol === symbol ? 'contained' : 'outlined'} onClick={() => update({ preparation: { ...prep, chartSymbol: symbol } })}>{label}</Button>)}</Stack>
    <TextField label={t('dailyReview.chartSymbol')} value={prep.chartSymbol} onChange={e => update({ preparation: { ...prep, chartSymbol: e.target.value } })} />
    <TextField select label={t('prepare.timeframe')} value={prep.chartInterval} onChange={e => update({ preparation: { ...prep, chartInterval: e.target.value } })}>{['1','5','15','30','60','D'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
    <Typography variant="caption">{prep.chartSymbol} · TradingView · {t('prepare.exchangeTimezone')}</Typography>
    <Button onClick={() => setChartExpanded(!chartExpanded)}>{t(chartExpanded ? 'dailyReview.compactMode' : 'dailyReview.chartMode')}</Button>
    {prep.chartSymbol === 'CME_MINI:ES1!' ? <Alert severity="warning">{t('prepare.esWidgetLimit')}</Alert> : <TradingViewWidget symbol={prep.chartSymbol} interval={prep.chartInterval} height={chartExpanded ? '85dvh' : '70dvh'} minHeight={420} hideControls={false} allowSymbolChange={false} fallbackMessage={t('today.session.mentor.liveChartFallback')} fallbackLinkLabel={t('today.session.mentor.openOnTradingView')} />}
    <Button href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(prep.chartSymbol)}`} target="_blank" rel="noopener noreferrer">{t('prepare.personalIndicators')}</Button><Typography variant="caption">{t('prepare.widgetLimits')}</Typography>
  </Stack></CardContent></Card>
  if (saved.isError) return <Alert severity="error" action={<Button onClick={() => void saved.refetch()}>{t('dailyReview.retry')}</Button>}>{t('dailyReview.loadError')}</Alert>
  if (!ready) return <Typography role="status">{t('dailyReview.loading')}</Typography>
  return <Stack component="fieldset" spacing={2} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {(['PREPARE', 'TRADE', 'REVIEW'] as const).map(state => <Button key={state} variant={draft.state === state ? 'contained' : 'outlined'} disabled={saveState === 'saving' || (state === 'TRADE' && !draft.readyContext)} onClick={() => update({ state })}>{t(`dailyReview.states.${state}`)}</Button>)}
      <Chip role="status" label={t(`dailyReview.save.${saveState}`)} />
    </Stack>
    {saveState === 'error' && <Alert severity="error" action={<Button onClick={async () => { const result = await saved.refetch(); if (result.data) { setConflictingDraft(draft); setRevision(result.data.revision); setDraft({ ...emptyReview, preparation: initialPreparation(), ...result.data.data }) } }}>{t('dailyReview.retry')}</Button>}>{t('dailyReview.saveError')}</Alert>}
    {conflictingDraft && <Card><CardContent><Stack spacing={1}><Typography>{t('dailyReview.conflictRecovery')}</Typography><Typography variant='body2'>{t('dailyReview.focus')}: {conflictingDraft.focus}</Typography><Typography variant='body2'>{t('dailyReview.nextFocus')}: {conflictingDraft.nextFocus}</Typography><Button onClick={() => { update(conflictingDraft); setConflictingDraft(null) }}>{t('dailyReview.restoreDraft')}</Button></Stack></CardContent></Card>}
    {executions.isError && <Alert severity="error">{t('dailyReview.loadError')}</Alert>}
    {draft.state !== 'PREPARE' && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      {[['net', knownMoney ? formatSignedCurrency(total, currency!) : '—'], ['closed', String(closed.length)], ['reviewed', `${reviewed}/${closed.length}`]].map(([key, value]) => <Card key={key}><CardContent sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">{t(`dailyReview.${key}`)}</Typography><Typography className="metric-value">{executions.isLoading ? '…' : value}</Typography></CardContent></Card>)}
    </Box>}
    {draft.state !== 'PREPARE' && <Typography variant="caption" color="text.secondary">{t('dailyReview.freshness', { time: executions.dataUpdatedAt ? formatDateTime(new Date(executions.dataUpdatedAt).toISOString(), timezone) : '—' })} · {timezone}</Typography>}
    {closed.length > 0 && !knownMoney && <Alert severity="info">{t('dailyReview.moneyUnavailable')}</Alert>}
    {draft.state === 'PREPARE' && permission && <Alert severity={permission.maximumPermittedRisk === 0 ? 'warning' : 'info'}>{t('dailyReview.capacity', { trades: permission.remainingTrades ?? '—', risk: permission.maximumPermittedRisk == null ? '—' : formatSignedCurrency(permission.maximumPermittedRisk, rules.data!.detail!.account.currency) })} · {t(permission.primaryReason)}</Alert>}
    {draft.state === 'PREPARE' && <PrepareSteps mentorStrategies={strategies.data?.mentorStrategies || []} reloadStrategies={() => { void strategies.refetch() }} date={date} draft={draft} update={update} strategies={strategies.data?.myStrategies || []} start={() => void save('TRADE')} saving={saveState === 'saving'} chart={chart} />}
    {draft.state !== 'PREPARE' && draft.readyContext && <Card><CardContent><Stack spacing={1}>
      <Typography component="h2" variant="h6">{t('prepare.ready')} · {formatDateTime(draft.readyContext.readyAt, timezone)}</Typography>
      <Typography>{draft.readyContext.instruments} · {draft.readyContext.focus}</Typography>
      <Typography>{draft.readyContext.strategyContext?.name || t('prepare.observe')} · {draft.readyContext.strategyContext?.versionId?.slice(0, 8)}</Typography>
      <Typography sx={{ whiteSpace: 'pre-line' }}>{draft.readyContext.preparation.chartPlan}</Typography>
      <Typography variant="caption">{t('prepare.reference')}: {draft.readyContext.briefing?.asOf ? formatDateTime(draft.readyContext.briefing.asOf, timezone) : '—'} · {draft.readyContext.briefing?.id.slice(0, 8)}</Typography>
    </Stack></CardContent></Card>}
    {draft.state === 'TRADE' && chart}
    {(draft.state === 'TRADE' || draft.state === 'REVIEW') && <Card><CardContent><SessionJournal accountId={accountId} date={date} session={session} /></CardContent></Card>}
    {draft.state !== 'PREPARE' && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
      <Card><CardContent><Stack spacing={2}>
        {(draft.state === 'TRADE' || draft.state === 'REVIEW') && <>
          <Typography component="h2" variant="h6">{t(draft.state === 'TRADE' ? 'dailyReview.timeline' : 'dailyReview.decisions')}</Typography>
          {draft.state === 'TRADE' && <><LogSessionTrade accountId={accountId} date={date} session={session} timezone={timezone} draft={draft} strategies={strategies.data?.myStrategies || []} onSaved={() => { void executions.refetch(); void rules.refetch() }} /><Button component={Link} to={scoped('/trades', '&import=1')}>{t('dailyReview.import')}</Button></>}
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
        {strategy && <><Typography fontWeight={700}>{draft.strategyContext?.name ?? strategy.name}</Typography><Typography variant="body2">{draft.strategyContext ? strategyText(draft.strategyContext.entry) : strategyText(strategy.entryConditions.join(' · '))}</Typography><Typography variant="body2">{t('dailyReview.invalidation')}: {strategyText(draft.strategyContext?.invalidation ?? strategy.invalidationLogic)}</Typography><Typography variant="body2">{t('dailyReview.noTrade')}: {strategyText(draft.strategyContext ? draft.strategyContext.noTrade : strategy.noTradeRules)}</Typography></>}
        {permission ? <Alert severity={permission.maximumPermittedRisk === 0 ? 'warning' : 'info'}><Typography variant='body2'>{t('dailyReview.capacity', { trades: permission.remainingTrades ?? '—', risk: permission.maximumPermittedRisk == null ? '—' : formatSignedCurrency(permission.maximumPermittedRisk, rules.data!.detail!.account.currency) })}</Typography><Typography variant='caption'>{t(permission.primaryReason)}</Typography></Alert> : <Typography variant='body2'>{t('dailyReview.rulesUnavailable')}</Typography>}
        <Typography variant='caption'>{t('dailyReview.ruleGuidance')}</Typography>
        <Button component={Link} to={scoped('/coach')}>{t('dailyReview.rules')}</Button><Button component={Link} to={scoped('/today/session')}>{t('dailyReview.chart')}</Button><Button component={Link} to={scoped('/notebook', `&date=${date}`)}>{t('dailyReview.notes')}</Button>
      </Stack></CardContent></Card>{observation ? <CoachAdviceCard card={observation} currency={observation.currency || ''} onViewTrades={setFinding} /> : <Alert severity='info'>{t('dailyReview.noObservation')}</Alert>}<Button component={Link} to={scoped('/analytics')}>{t('dailyReview.reviewEvidence')}</Button></Stack>
    </Box>}
    {draft.state === 'PREPARE' && <Button onClick={() => void save()} disabled={saveState === 'saving'}>{t('dailyReview.saveDraft')}</Button>}
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
      {executionContext.data?.readyContext ? <Card><CardContent><Typography>{executionContext.data.readyContext.readyAt}</Typography><Typography>{executionContext.data.readyContext.focus}</Typography><Typography>{executionContext.data.readyContext.strategyContext?.name}</Typography><Typography>{executionContext.data.readyContext.preparation.chartPlan}</Typography><Typography variant="caption">{executionContext.data.readyContext.briefing?.asOf}</Typography></CardContent></Card> : <Typography>{t('prepare.noLinkedPreparation')}</Typography>}
      <Typography>{selected && formatNetResult(selected)}</Typography><Alert severity="info">{t('dailyReview.contextBasis')}</Alert>
      <ToggleButtonGroup exclusive value={assessment?.decision || null} onChange={(_, value) => { if (value) assess(value) }} sx={{ flexWrap: 'wrap' }}>{['FOLLOWED', 'DEVIATED', 'CANNOT_ASSESS'].map(x => <ToggleButton key={x} value={x}>{t(`dailyReview.assessment.${x}`)}</ToggleButton>)}</ToggleButtonGroup>
      <TextField label={t('dailyReview.note')} multiline minRows={3} value={assessment?.note || ''} onChange={e => assess(assessment?.decision || 'CANNOT_ASSESS', e.target.value)} />
      {selected && <TradeReviewAssets key={selected.id} tradeId={selected.id} />}
      <Button component={Link} to={scoped('/trades', `&tradeId=${selected?.id}`)}>{t('dailyReview.fullTrade')}</Button>
    </Stack></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>{t('common.close')}</Button><Button disabled={saveState === 'saving'} onClick={() => void save()}>{t('dailyReview.saveDraft')}</Button></DialogActions></Dialog>
  </Stack>
}
