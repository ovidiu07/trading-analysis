import { useRef, useState } from 'react'
import { apiPost } from '../../api/client'
import { BriefingPanel } from './BriefingPanel'
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, MenuItem, Stack, Step, StepButton, Stepper, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Preparation, SessionReview } from '../../api/sessionReviews'
import { StrategyResponse } from '../../api/strategies'
import { useI18n } from '../../i18n'
import { initialPreparation, strategyText } from './context'

export function PrepareSteps({ date, draft, update, strategies, start, saving, chart, mentorStrategies, reloadStrategies }: {
  date: string; draft: SessionReview; update: (value: Partial<SessionReview>) => void; strategies: StrategyResponse[];
  mentorStrategies: StrategyResponse[]; reloadStrategies: () => void; start: () => void; saving: boolean; chart: React.ReactNode
}) {
  const { t } = useI18n()
  const [adopting, setAdopting] = useState(false)
  const [adoptionError, setAdoptionError] = useState(false)
  const [restoreId, setRestoreId] = useState<string>()
  const adopt = async (id: string, restore = false) => {
    setAdopting(true); setAdoptionError(false)
    try {
      const strategy = await apiPost<StrategyResponse>(`/strategies/mentor/${id}/adopt?restore=${restore}`, {})
      if (strategy.archived) setRestoreId(id)
      else { reloadStrategies(); update({ strategyId: strategy.id, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [] } }); setRestoreId(undefined) }
    } catch { setAdoptionError(true) } finally { setAdopting(false) }
  }
  const p = draft.preparation || initialPreparation()
  const preparationRef = useRef(p)
  preparationRef.current = p
  const patch = (value: Partial<Preparation>) => update({ preparation: { ...preparationRef.current, ...value } })
  const steps = ['briefing', 'coach', 'strategy', 'analysis']
  const selected = strategies.find(s => s.id === draft.strategyId)
  return <Stack spacing={2}>
    <Stepper nonLinear activeStep={p.step} alternativeLabel sx={{ '& .MuiStepLabel-label': { overflowWrap: 'anywhere' } }}>
      {steps.map((step, index) => <Step key={step} completed={index === 0 ? p.contextAcknowledged : index === 1 ? Boolean(draft.focus) : index === 2 ? Boolean(draft.strategyId || p.observing) : p.chartConfirmed}>
        <StepButton onClick={() => patch({ step: index })} aria-current={p.step === index ? 'step' : undefined}>{t(`prepare.${step}`)}</StepButton>
      </Step>)}
    </Stepper>
    {p.step === 0 && <Card><CardContent><Stack spacing={2}>
      <Typography variant="h6" component="h2">{t('prepare.briefing')}</Typography>
      <BriefingPanel date={date} preparation={p} onVersion={id => patch({ briefingId: id })} onSelection={patch} />
      <FormControlLabel control={<Checkbox checked={p.contextAcknowledged} onChange={e => patch({ contextAcknowledged: e.target.checked })} />} label={t('prepare.acknowledge')} />
    </Stack></CardContent></Card>}
    {p.step === 1 && <Stack spacing={2}>
      <BriefingPanel coach date={date} preparation={p} onSelection={patch} onVersion={id => patch({ briefingId: id })} />
      <TextField label={t('prepare.thesis')} value={draft.focus} multiline minRows={3} inputProps={{ maxLength: 2000 }} onChange={e => update({ focus: e.target.value })} />
      <TextField select label={t('prepare.bias')} value={p.bias} onChange={e => patch({ bias: e.target.value as Preparation['bias'] })}>{['bullish', 'bearish', 'neutral', 'mixed'].map(b => <MenuItem value={b} key={b}>{t(`prepare.${b}`)}</MenuItem>)}</TextField>
    </Stack>}
    {p.step === 2 && <Stack spacing={2}>
      <FormControlLabel control={<Checkbox checked={p.observing} onChange={e => { update({ strategyId: e.target.checked ? null : draft.strategyId, preparation: { ...p, observing: e.target.checked, checklist: [] } }) }} />} label={t('prepare.observe')} />
      <Button component={Link} to="/strategies">{t('prepare.library')}</Button>
      {adoptionError && <Alert severity="error">{t('dailyReview.saveError')}</Alert>}
      {restoreId && <Button disabled={adopting} onClick={() => void adopt(restoreId, true)}>{t('prepare.restore')}</Button>}
      <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>Mentor</Box><Stack spacing={1}>{mentorStrategies.map(strategy => <Card key={strategy.id}><CardContent><Typography variant="h6">{strategy.name}</Typography><Typography>{strategyText(strategy.model)}</Typography><Button disabled={adopting} onClick={() => void adopt(strategy.id)}>{t('prepare.useTemplate')}</Button></CardContent></Card>)}</Stack></Box>
      {strategies.filter(s => !s.archived || s.id === draft.strategyId).map(strategy => <Card key={strategy.id} variant="outlined" sx={{ borderWidth: strategy.id === draft.strategyId ? 2 : 1, borderColor: strategy.id === draft.strategyId ? 'primary.main' : 'divider' }}><CardContent><Stack spacing={1}>
        <Typography component="h2" variant="h6">{strategyText(strategy.name)}</Typography><Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{strategyText(strategy.model)}</Typography>
        <Button variant={strategy.id === draft.strategyId ? 'contained' : 'outlined'} onClick={() => update({ strategyId: strategy.id, strategyContext: undefined, preparation: { ...p, observing: false, checklist: [] } })}>{t(strategy.id === draft.strategyId ? 'prepare.selected' : 'prepare.select')}</Button>
        {strategy.id === draft.strategyId && strategy.entryConditions.slice(0, 20).map((rule, index) => <FormControlLabel key={index} control={<Checkbox checked={p.checklist[index] || false} onChange={e => { const checklist = [...p.checklist]; checklist[index] = e.target.checked; patch({ checklist }) }} />} label={strategyText(rule)} />)}
        <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>{t('prepare.rules')}</Box><Stack spacing={1} sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere', lineHeight: 1.7 }}>
          <Typography>{strategyText(strategy.entryConditionsRich)}</Typography><Typography>{t('dailyReview.invalidation')}: {strategyText(strategy.invalidationLogic)}</Typography><Typography>{t('prepare.targets')}: {strategyText(strategy.tpFramework)}</Typography><Typography>{t('dailyReview.noTrade')}: {strategyText(strategy.noTradeRules)}</Typography><Typography variant="caption">{strategy.updatedAt}</Typography>
        </Stack></Box>
      </Stack></CardContent></Card>)}
    </Stack>}
    {p.step === 3 && <Stack spacing={2}>{chart}
      <TextField label={t('prepare.chartPlan')} multiline minRows={3} value={p.chartPlan} inputProps={{ maxLength: 4000 }} onChange={e => patch({ chartPlan: e.target.value })} helperText={t('prepare.notesOnly')} />
      <FormControlLabel control={<Checkbox checked={p.chartConfirmed} onChange={e => patch({ chartConfirmed: e.target.checked })} />} label={t('prepare.chartConfirmed')} />
      <Card><CardContent><Stack spacing={1}><Typography variant="h6" component="h2">{t('prepare.ready')}</Typography><Typography>{draft.instruments || p.chartSymbol}</Typography><Typography>{draft.focus}</Typography><Typography>{selected?.name || t('prepare.observe')}</Typography><Typography>{p.chartPlan}</Typography><FormControlLabel control={<Checkbox checked={p.preparationConfirmed} onChange={e => patch({ preparationConfirmed: e.target.checked })} />} label={t('prepare.confirm')} /><Typography variant="caption">{t('prepare.readyMeaning')}</Typography>
      <Button variant="contained" disabled={saving || !p.contextAcknowledged || !p.chartConfirmed || !p.preparationConfirmed || !(draft.strategyId || p.observing)} onClick={start}>{t('prepare.start')}</Button></Stack></CardContent></Card>
    </Stack>}
    <Stack direction="row" justifyContent="space-between"><Button disabled={p.step === 0} onClick={() => patch({ step: p.step - 1 })}>{t('prepare.previous')}</Button><Button disabled={p.step === 3} variant="outlined" onClick={() => patch({ step: p.step + 1 })}>{t('prepare.continue')}</Button></Stack>
  </Stack>
}
