import { useMemo, useRef, useState } from 'react'
import { apiPost } from '../../api/client'
import { BriefingPanel } from './BriefingPanel'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
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
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { Link } from 'react-router-dom'
import { Preparation, SessionReview } from '../../api/sessionReviews'
import { StrategyResponse } from '../../api/strategies'
import { useI18n } from '../../i18n'
import { initialPreparation, strategyText } from './context'
import MarketIntelligenceGrid from '../../components/trading-workspace/MarketIntelligenceGrid'
import { PanelNumber, WorkstationCard } from '../../components/trading-workspace/WorkspacePrimitives'
import { TodayRiskPanel } from '../risk/TodayRiskPanel'
import type { SetupDirection, SetupItem } from '../../api/liveWorkspace'
import { canonicalMarketInstrument, type AnalysisMetrics, type InstrumentQuote, type MacroObservation } from '../../api/marketData'

const demoSetupLabelKeys = ['liquiditySweep', 'displacement', 'mssChoch', 'fvgImbalance', 'orderBlock', 'htfConfluence'] as const

type EmotionalState = 'calm' | 'focused' | 'neutral' | 'anxious' | 'fomo'

export function PrepareSteps({ date, draft, update, strategies, start, saving, chart, mentorStrategies, reloadStrategies, userId, accountId, accountLabel, accountCurrency, isCurrentDate, session, symbol, market, direction, maximumPermittedRisk, maximumPermittedRiskPct, remainingTrades, capacityReason, marketQuotes, macroObservations, marketAnalysis }: {
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
  marketAnalysis?: AnalysisMetrics | null
}) {
  const { t } = useI18n()
  const [adopting, setAdopting] = useState(false)
  const [adoptionError, setAdoptionError] = useState(false)
  const [restoreId, setRestoreId] = useState<string>()
  const [emotion, setEmotion] = useState<EmotionalState>('calm')
  const [discipline, setDiscipline] = useState({ chasing: false, revenge: false, social: false })

  const p = draft.preparation || initialPreparation()
  const preparationRef = useRef(p)
  preparationRef.current = p
  const patch = (value: Partial<Preparation>) => update({ preparation: { ...preparationRef.current, ...value } })
  const selected = strategies.find((strategy) => strategy.id === draft.strategyId)
  const savedSetupLabels = selected?.entryConditions.slice(0, 12).map(strategyText).filter(Boolean)
  const setupLabels = savedSetupLabels?.length ? savedSetupLabels : demoSetupLabelKeys.map((key) => t(`workstation.setupElements.${key}`))

  const adopt = async (id: string, restore = false) => {
    setAdopting(true)
    setAdoptionError(false)
    try {
      const strategy = await apiPost<StrategyResponse>(`/strategies/mentor/${id}/adopt?restore=${restore}`, {})
      if (strategy.archived) {
        setRestoreId(id)
      } else {
        reloadStrategies()
        update({ strategyId: strategy.id, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [] } })
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
    { label: t('workstation.validation.emotion'), valid: emotion !== 'anxious' && emotion !== 'fomo' && !discipline.revenge }
  ], [discipline.revenge, draft.focus, draft.strategyId, emotion, p.chartConfirmed, p.chartPlan, p.checklist, p.contextAcknowledged, p.observing, t])
  const validCount = validations.filter((item) => item.valid).length
  const validationScore = Math.round((validCount / validations.length) * 100)
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
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap aria-label={t('workstation.preparationSections')}>
        {[
          ['briefing', t('prepare.briefing')],
          ['context', t('prepare.coach')],
          ['setup', t('prepare.strategy')],
          ['chart', t('prepare.analysis')]
        ].map(([key, label], index) => (
          <Button key={key} size="small" variant={index === p.step ? 'contained' : 'outlined'} onClick={() => patch({ step: index })}>
            {label}
          </Button>
        ))}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.38fr) minmax(520px, 1fr)' }, gap: 1.25, alignItems: 'start' }}>
        <Box id="today-chart" sx={{ minWidth: 0 }}>{chart}</Box>
        <MarketIntelligenceGrid
          preparation={p}
          thesis={draft.focus}
          date={date}
          selectedInstrument={canonicalMarketInstrument(p.chartSymbol, symbol)}
          quotes={marketQuotes}
          macroObservations={macroObservations}
          analysis={marketAnalysis}
          briefing={<BriefingPanel coach date={date} preparation={p} onSelection={patch} onVersion={(id) => patch({ briefingId: id })} />}
          onAcknowledge={(checked) => patch({ contextAcknowledged: checked })}
          acknowledgeLabel={t('prepare.acknowledge')}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '1.12fr 0.88fr 1.08fr 1.08fr 1fr' },
          gap: 1.25,
          alignItems: 'stretch'
        }}
      >
        <WorkstationCard title={t('workstation.setup')} icon={TuneRoundedIcon} action={<PanelNumber>1</PanelNumber>}>
          <Stack spacing={1.15}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={p.bias === 'bullish' ? 'long' : p.bias === 'bearish' ? 'short' : null}
              onChange={(_, value: 'long' | 'short' | null) => value && patch({ bias: value === 'long' ? 'bullish' : 'bearish' })}
              aria-label={t('workstation.tradeDirection')}
            >
              <ToggleButton value="long" color="success">{t('workstation.long')}</ToggleButton>
              <ToggleButton value="short" color="error">{t('workstation.short')}</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              size="small"
              label={t('workstation.strategy')}
              value={draft.strategyId || ''}
              onChange={(event) => update({ strategyId: event.target.value || null, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [] } })}
            >
              <MenuItem value="">{t('workstation.chooseStrategy')}</MenuItem>
              {strategies.filter((strategy) => !strategy.archived || strategy.id === draft.strategyId).map((strategy) => (
                <MenuItem key={strategy.id} value={strategy.id}>{strategyText(strategy.name)}</MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={p.observing} onChange={(event) => update({ strategyId: event.target.checked ? null : draft.strategyId, preparation: { ...p, observing: event.target.checked, checklist: [] } })} />}
              label={t('prepare.observe')}
              sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12.5 } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t('workstation.setupElements.title')}</Typography>
            <Stack spacing={0.1}>
              {setupLabels.slice(0, 7).map((label, index) => (
                <FormControlLabel
                  key={`${label}-${index}`}
                  control={<Checkbox size="small" checked={p.checklist[index] || false} onChange={(event) => { const checklist = [...p.checklist]; checklist[index] = event.target.checked; patch({ checklist }) }} />}
                  label={label}
                  sx={{ m: 0, minWidth: 0, '& .MuiFormControlLabel-label': { fontSize: 12, lineHeight: 1.35, overflowWrap: 'anywhere' } }}
                />
              ))}
            </Stack>
            <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 1.1, bgcolor: 'action.hover' }}>
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.1 }} />
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>{t('workstation.screenshotPlaceholder')}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('workstation.screenshotBoundary')}</Typography>
                </Box>
              </Stack>
            </Box>
            <Button component={Link} to="/strategies" size="small" variant="text" sx={{ alignSelf: 'flex-start' }}>{t('prepare.library')}</Button>
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
        />

        <WorkstationCard title={t('workstation.tradePlan')} icon={DescriptionOutlinedIcon} action={<PanelNumber>3</PanelNumber>}>
          <Stack spacing={1.1}>
            <TextField
              size="small"
              label={t('prepare.thesis')}
              value={draft.focus}
              multiline
              minRows={4}
              inputProps={{ maxLength: 2000 }}
              onChange={(event) => update({ focus: event.target.value })}
            />
            <TextField
              size="small"
              label={t('workstation.chartPlan')}
              value={p.chartPlan}
              multiline
              minRows={5}
              inputProps={{ maxLength: 4000 }}
              onChange={(event) => patch({ chartPlan: event.target.value })}
              helperText={t('prepare.notesOnly')}
            />
            <FormControlLabel
              control={<Checkbox checked={p.chartConfirmed} onChange={(event) => patch({ chartConfirmed: event.target.checked })} />}
              label={t('prepare.chartConfirmed')}
              sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 12.5, pt: 0.65 } }}
            />
          </Stack>
        </WorkstationCard>

        <WorkstationCard title={t('workstation.psychology')} icon={PsychologyAltOutlinedIcon} action={<PanelNumber>4</PanelNumber>}>
          <Stack spacing={1.1}>
            <Stack direction="row" spacing={0.5} justifyContent="space-between">
              {emotionalOptions.map((item) => (
                <Button
                  key={item.value}
                  aria-pressed={emotion === item.value}
                  onClick={() => setEmotion(item.value)}
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
                control={<Checkbox checked={discipline[key]} onChange={(event) => setDiscipline((current) => ({ ...current, [key]: event.target.checked }))} />}
                label={t(labelKey)}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
              />
            ))}
            <Typography variant="caption" color="text.secondary">{t('workstation.psychologyBoundary')}</Typography>
          </Stack>
        </WorkstationCard>

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
            <Box>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">{t('workstation.preparationCompleteness')}</Typography>
                <Typography className="metric-value" sx={{ fontWeight: 800, color: validationScore >= 80 ? 'trading.profit' : 'primary.main' }}>{validationScore}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={validationScore} color={validationScore >= 80 ? 'success' : 'primary'} sx={{ mt: 0.75, height: 7, borderRadius: 1 }} />
            </Box>
            <Typography variant="caption" color="text.secondary">{t('workstation.scoreBoundary')}</Typography>
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
    </Stack>
  )
}
