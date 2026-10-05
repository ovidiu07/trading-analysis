import { useMemo, useRef, useState } from 'react'
import { apiPost } from '../../api/client'
import { BriefingPanel } from './BriefingPanel'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import SentimentSatisfiedAltRoundedIcon from '@mui/icons-material/SentimentSatisfiedAltRounded'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import { Link } from 'react-router-dom'
import { Preparation, SessionReview } from '../../api/sessionReviews'
import { StrategyResponse } from '../../api/strategies'
import { useI18n } from '../../i18n'
import { initialPreparation, strategyText } from './context'
import NewsEventsPanel from '../news/NewsEventsPanel'
import MarketIntelligenceGrid from '../../components/trading-workspace/MarketIntelligenceGrid'
import { PanelNumber, WorkstationCard } from '../../components/trading-workspace/WorkspacePrimitives'
import { TodayRiskPanel } from '../risk/TodayRiskPanel'
import type { SetupDirection, SetupItem } from '../../api/liveWorkspace'
import { type AnalysisMetrics, type InstrumentQuote, type MacroObservation } from '../../api/marketData'

const demoSetupLabelKeys = ['liquiditySweep', 'displacement', 'mssChoch', 'fvgImbalance', 'orderBlock', 'htfConfluence'] as const

type EmotionalState = 'calm' | 'focused' | 'neutral' | 'anxious' | 'fomo'

export function PrepareSteps({ date, draft, update, strategies, start, saving, chart, mentorStrategies, reloadStrategies, userId, accountId, accountLabel, accountCurrency, isCurrentDate, session, symbol, market, direction, maximumPermittedRisk, maximumPermittedRiskPct, remainingTrades, capacityReason, marketQuotes, macroObservations, marketAnalysis, displayTimezone = 'Europe/Bucharest' }: {
  date: string
  draft: SessionReview
  update: (value: Partial<SessionReview>) => void
  strategies: StrategyResponse[]
  mentorStrategies: StrategyResponse[]
  reloadStrategies: () => void
  start: () => void
  saving: boolean
  chart: React.ReactNode
  userId: string
  accountId: string
  accountLabel: string
  accountCurrency: string
  isCurrentDate: boolean
  session: string
  symbol: string
  market: NonNullable<SetupItem['market']>
  direction: SetupDirection
  maximumPermittedRisk?: number | null
  maximumPermittedRiskPct?: number | null
  remainingTrades?: number | null
  capacityReason?: string | null
  marketQuotes?: InstrumentQuote[]
  macroObservations?: MacroObservation[]
  displayTimezone?: string
  marketAnalysis?: AnalysisMetrics | null
}) {
  const { t } = useI18n()
  const [adopting, setAdopting] = useState(false)
  const [adoptionError, setAdoptionError] = useState(false)
  const [restoreId, setRestoreId] = useState<string>()
  const [contextOpen, setContextOpen] = useState(false)

  const p = draft.preparation || initialPreparation()
  const emotion = p.emotion
  const discipline = p.discipline || { chasing: false, revenge: false, social: false }
  const preparationRef = useRef(p)
  preparationRef.current = p
  const patch = (value: Partial<Preparation>) => update({ preparation: { ...preparationRef.current, ...value } })
  const selected = strategies.find((strategy) => strategy.id === draft.strategyId)
  const savedSetupLabels = selected?.entryConditions.slice(0, 12).map(strategyText).filter(Boolean)
  const setupLabels = p.checklistLabels?.length ? p.checklistLabels : savedSetupLabels?.length ? savedSetupLabels : demoSetupLabelKeys.map((key) => t(`workstation.setupElements.${key}`))

  const adopt = async (id: string, restore = false) => {
    setAdopting(true)
    setAdoptionError(false)
    try {
      const strategy = await apiPost<StrategyResponse>(`/strategies/mentor/${id}/adopt?restore=${restore}`, {})
      if (strategy.archived) {
        setRestoreId(id)
      } else {
        reloadStrategies()
        update({ strategyId: strategy.id, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [], checklistLabels: [] } })
        setRestoreId(undefined)
      }
    } catch {
      setAdoptionError(true)
    } finally {
      setAdopting(false)
    }
  }

  const validations = useMemo(() => [
    { label: t('workstation.validation.context'), valid: p.contextAcknowledged },
    { label: t('workstation.validation.strategy'), valid: Boolean(draft.strategyId || p.observing) },
    { label: t('workstation.validation.setup'), valid: p.checklist.some(Boolean) || p.observing },
    { label: t('workstation.validation.thesis'), valid: Boolean(draft.focus.trim()) },
    { label: t('workstation.validation.plan'), valid: Boolean(p.chartPlan.trim()) },
    { label: t('workstation.validation.chart'), valid: p.chartConfirmed },
    { label: t('workstation.validation.emotion'), valid: Boolean(emotion) && emotion !== 'anxious' && emotion !== 'fomo' && !discipline.revenge }
  ], [discipline.revenge, draft.focus, draft.strategyId, emotion, p.chartConfirmed, p.chartPlan, p.checklist, p.contextAcknowledged, p.observing, t])
  const validCount = validations.filter((item) => item.valid).length

  const ready = p.contextAcknowledged && p.chartConfirmed && p.preparationConfirmed && Boolean(draft.strategyId || p.observing)

  const emotionalOptions: Array<{ value: EmotionalState; label: string; icon: React.ReactNode }> = [
    { value: 'calm', label: t('workstation.emotions.calm'), icon: <SentimentSatisfiedAltRoundedIcon /> },
    { value: 'focused', label: t('workstation.emotions.focused'), icon: <CenterFocusStrongRoundedIcon /> },
    { value: 'neutral', label: t('workstation.emotions.neutral'), icon: <RemoveCircleOutlineRoundedIcon /> },
    { value: 'anxious', label: t('workstation.emotions.anxious'), icon: <WarningAmberRoundedIcon /> },
    { value: 'fomo', label: 'FOMO', icon: <BoltRoundedIcon /> }
  ]

  return (
    <Stack spacing={1.25}>
      <Box data-testid="chart-plan-workspace" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2.1fr) minmax(360px, 1fr)' }, gap: 1.25, alignItems: 'start' }}>
        <Stack spacing={1} sx={{ minWidth: 0, position: { lg: 'sticky' }, top: 12 }}>
          <Box id="today-chart" sx={{ minWidth: 0 }}>{chart}</Box>
          <NewsEventsPanel compact instrument={p.chartSymbol || symbol} date={date} timezone={displayTimezone} isCurrentDate={isCurrentDate} asOf={!isCurrentDate ? draft.readyContext?.readyAt : undefined} />
          <Button variant="outlined" onClick={() => setContextOpen(true)} sx={{ justifyContent: 'space-between' }}>{t('workstation.marketContext')} · {t(p.contextAcknowledged ? 'chartPlan.reviewed' : 'chartPlan.reviewContext')}</Button>
          <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
            <Box component="summary" sx={{ cursor: 'pointer', fontSize: 13 }}>{t('chartPlan.sessionNotes')}</Box>
            <TextField fullWidth multiline minRows={3} label={t('chartPlan.sessionNotes')} value={p.sessionNotes || ''} onChange={e => patch({ sessionNotes: e.target.value })} inputProps={{ maxLength: 8000 }} sx={{ mt: 2 }} />
          </Box>
        </Stack>
        <Stack component="aside" aria-label={t('workstation.tradePlan')} spacing={0} sx={{ minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper', overflow: 'hidden', '& .MuiCardContent-root': { p: 1.25, '&:last-child': { pb: 1.25 } }, '& .workstation-card .workstation-card > .MuiCardContent-root': { px: 0 }, '& .workstation-card': { border: 0, borderRadius: 0, height: 'auto', backgroundColor: 'transparent' }, '& .workstation-card + .workstation-card': { borderTop: '1px solid', borderColor: 'divider' } }}>
          <Box sx={{ px: 2, pt: 1.75 }}><Typography variant="h6" fontWeight={700}>{t('workstation.tradePlan')}</Typography><Typography variant="caption" color="text.secondary">{p.chartSymbol.includes('DE30') ? 'GER40' : symbol} · {t('chartPlan.draft')}</Typography></Box>
        <WorkstationCard title={t('workstation.setup')} icon={TuneRoundedIcon} action={<PanelNumber>1</PanelNumber>}>
          <Stack spacing={1.15}>
            <TextField
              select
              size="small"
              label={t('workstation.strategy')}
              value={draft.strategyId || ''}
              onChange={(event) => update({ strategyId: event.target.value || null, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [], checklistLabels: [] } })}
            >
              <MenuItem value="">{t('workstation.chooseStrategy')}</MenuItem>
              {strategies.filter((strategy) => !strategy.archived || strategy.id === draft.strategyId).map((strategy) => (
                <MenuItem key={strategy.id} value={strategy.id}>{strategyText(strategy.name)}</MenuItem>
              ))}
            </TextField>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={p.observing ? 'observe' : p.bias === 'bullish' ? 'long' : p.bias === 'bearish' ? 'short' : null}
              onChange={(_, value: 'long' | 'short' | 'observe' | null) => value && patch({ observing: value === 'observe', bias: value === 'long' ? 'bullish' : value === 'short' ? 'bearish' : 'neutral' })}
              aria-label={t('workstation.tradeDirection')}
            >
              <ToggleButton value="long" color="success">{t('workstation.long')}</ToggleButton>
              <ToggleButton value="short" color="error">{t('workstation.short')}</ToggleButton>
              <ToggleButton value="observe">{t('chartPlan.observe')}</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.25}>
              {setupLabels.map((label, index) => (
                <FormControlLabel
                  key={`${label}-${index}`}
                  control={<Checkbox size="small" checked={p.checklist[index] || false} onChange={(event) => { const checklist = [...p.checklist]; checklist[index] = event.target.checked; patch({ checklist, checklistLabels: setupLabels }) }} />}
                  label={label}
                  sx={{ m: 0, minWidth: 0, '& .MuiCheckbox-root': { p: 0.5 }, '& .MuiFormControlLabel-label': { fontSize: 12, lineHeight: 1.35, overflowWrap: 'anywhere' } }}
                />
              ))}
            </Stack>
            <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', fontSize: 11, color: 'text.secondary' }}>{t('chartPlan.strategyLibrary')}</Box><Button component={Link} to="/strategies" size="small" variant="text" sx={{ alignSelf: 'flex-start' }}>{t('prepare.library')}</Button></Box>
            {adoptionError ? <Alert severity="error">{t('dailyReview.saveError')}</Alert> : null}
            {restoreId ? <Button disabled={adopting} onClick={() => void adopt(restoreId, true)}>{t('prepare.restore')}</Button> : null}
            {mentorStrategies.length ? (
              <Box component="details">
                <Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: 12 }}>{t('workstation.mentorTemplates')}</Box>
                <Stack spacing={0.75} sx={{ pt: 0.75 }}>
                  {mentorStrategies.slice(0, 4).map((strategy) => <Button key={strategy.id} disabled={adopting} variant="outlined" onClick={() => void adopt(strategy.id)}>{strategy.name}</Button>)}
                </Stack>
              </Box>
            ) : null}
          </Stack>
        </WorkstationCard>

        <TodayRiskPanel
          key={`${accountId}:${date}:${session}:${market}:${symbol}`}
          userId={userId}
          accountId={accountId}
          accountLabel={accountLabel}
          accountCurrency={accountCurrency}
          date={date}
          isCurrentDate={isCurrentDate}
          session={session}
          symbol={symbol}
          market={market}
          direction={direction}
          strategyId={draft.strategyId}
          strategyLabel={selected?.name}
          thesis={draft.focus}
          defaultInvalidation={p.chartPlan}
          maximumPermittedRisk={maximumPermittedRisk}
          maximumPermittedRiskPct={maximumPermittedRiskPct}
          remainingTrades={remainingTrades}
          capacityReason={capacityReason}
          preparationSnapshot={{ version: 1, accountId, date, session, timezone: displayTimezone, review: { ...draft, preparation: { ...p, checklistLabels: p.checklistLabels?.length ? p.checklistLabels : setupLabels } }, strategyDefinition: selected || null }}
          storedDraft={p.riskDrafts?.[`${market}:${symbol}`]}
          onDraftChange={riskDraft => patch({ riskDrafts: { ...preparationRef.current.riskDrafts, [`${market}:${symbol}`]: riskDraft } })}
          afterFields={<>        <WorkstationCard title={t('workstation.tradePlan')} icon={DescriptionOutlinedIcon} action={<PanelNumber>3</PanelNumber>}>
          <Stack spacing={1.1}>
            <TextField
              size="small"
              label={t('prepare.thesis')}
              value={draft.focus}
              multiline
              minRows={1}
              inputProps={{ maxLength: 2000 }}
              onChange={(event) => update({ focus: event.target.value })}
            />
            <TextField
              size="small"
              label={t('workstation.chartPlan')}
              value={p.chartPlan}
              multiline
              minRows={1}
              inputProps={{ maxLength: 4000 }}
              onChange={(event) => patch({ chartPlan: event.target.value })}

            />
            <FormControlLabel
              control={<Checkbox checked={p.chartConfirmed} onChange={(event) => patch({ chartConfirmed: event.target.checked })} />}
              label={t('prepare.chartConfirmed')}
              sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 12.5, pt: 0.65 } }}
            />
          </Stack>
        </WorkstationCard>

        <Box component="details" sx={{ borderTop: '1px solid', borderColor: 'divider' }}><Box component="summary" sx={{ cursor: 'pointer', px: 1, py: 1, fontSize: 12 }}>{t('workstation.psychology')} · {emotion ? t(`workstation.emotions.${emotion}`) : t('chartPlan.notCompleted')}</Box>
        <WorkstationCard title={t('workstation.psychology')} icon={PsychologyAltOutlinedIcon} action={<PanelNumber>4</PanelNumber>}>
          <Stack spacing={1.1}>
            <Stack direction="row" spacing={0.5} justifyContent="space-between">
              {emotionalOptions.map((item) => (
                <Button
                  key={item.value}
                  aria-pressed={emotion === item.value}
                  onClick={() => patch({ emotion: item.value })}
                  color={item.value === 'anxious' || item.value === 'fomo' ? 'warning' : 'primary'}
                  variant={emotion === item.value ? 'contained' : 'text'}
                  sx={{ minWidth: 0, flex: 1, px: 0.25, py: 0.75, flexDirection: 'column', gap: 0.35, fontSize: 10.5 }}
                >
                  {item.icon}{item.label}
                </Button>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t('workstation.followingPlan')}</Typography>
            <FormControlLabel control={<Checkbox checked={!discipline.chasing && !discipline.revenge && !discipline.social} readOnly />} label={t('workstation.discipline.yes')} sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }} />
            {([
              ['chasing', 'workstation.discipline.chasing'],
              ['revenge', 'workstation.discipline.revenge'],
              ['social', 'workstation.discipline.social']
            ] as const).map(([key, labelKey]) => (
              <FormControlLabel
                key={key}
                control={<Checkbox checked={discipline[key]} onChange={(event) => patch({ discipline: { ...discipline, [key]: event.target.checked } })} />}
                label={t(labelKey)}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
              />
            ))}
            <TextField size="small" multiline minRows={1} label={t('chartPlan.psychologyNotes')} value={p.psychologyNotes || ''} onChange={e => patch({ psychologyNotes: e.target.value })} inputProps={{ maxLength: 4000 }} />
          </Stack>
        </WorkstationCard>

        </Box>
        <Box component="details" sx={{ borderTop: '1px solid', borderColor: 'divider' }}><Box component="summary" sx={{ cursor: 'pointer', px: 1, py: 1, fontSize: 12 }}>{t('workstation.tradeValidation')} · {validCount}/{validations.length}</Box>
        <WorkstationCard title={t('workstation.tradeValidation')} icon={VerifiedUserOutlinedIcon} action={<PanelNumber>5</PanelNumber>}>
          <Stack spacing={1.1}>
            <Stack spacing={0.55}>
              {validations.map((item) => (
                <Stack key={item.label} direction="row" spacing={0.75} alignItems="center">
                  {item.valid ? <CheckCircleRoundedIcon sx={{ fontSize: 17, color: 'trading.profit' }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 17, color: 'text.disabled' }} />}
                  <Typography variant="caption" color={item.valid ? 'text.primary' : 'text.secondary'}>{item.label}</Typography>
                </Stack>
              ))}
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={p.preparationConfirmed} onChange={(event) => patch({ preparationConfirmed: event.target.checked })} />}
              label={t('prepare.confirm')}
              sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 12.5, pt: 0.65 } }}
            />
            <Button variant="contained" disabled={saving || !ready} onClick={start}>{t('prepare.start')}</Button>
            <Typography variant="caption" color="text.secondary">{t('prepare.readyMeaning')}</Typography>
          </Stack>
        </WorkstationCard>
        </Box>
</>}
        />

        </Stack>
      </Box>
      <Drawer anchor="right" open={contextOpen} onClose={() => setContextOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%', p: 2 } }}>
        <Button onClick={() => setContextOpen(false)} sx={{ alignSelf: 'flex-end' }}>{t('common.close')}</Button>
        <MarketIntelligenceGrid preparation={p} thesis={draft.focus} date={date} selectedInstrument={p.chartSymbol || symbol} displayTimezone={displayTimezone} isCurrentDate={isCurrentDate} macroObservations={macroObservations} hideNews briefing={<BriefingPanel coach date={date} preparation={p} onSelection={patch} onVersion={id => patch({ briefingId: id })} />} onAcknowledge={checked => patch({ contextAcknowledged: checked })} acknowledgeLabel={t('prepare.acknowledge')} />
      </Drawer>
    </Stack>
  )
}
