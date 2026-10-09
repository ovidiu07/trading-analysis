import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { BacktestingTrade, BacktestingTradeBulkChanges, BacktestingTradeBulkPayload, updateBacktestingTrades } from '../../api/backtesting'
import { useI18n } from '../../i18n'

type Field = keyof BacktestingTradeBulkChanges
const textFields: Array<[Field, string]> = [
  ['contextTimeframe', 'contextTimeframe'],
  ['executionTimeframe', 'executionTimeframe'], ['entryTimeframe', 'entryTimeframe'], ['notes', 'notes'], ['tags', 'tags']
]

export default function BulkTradeEditDialog({ workspaceId, trades, preset, onClose, onSaved }: {
  workspaceId: string; trades: BacktestingTrade[]; preset?: boolean; onClose: () => void; onSaved: () => Promise<void>
}) {
  const { t } = useI18n()
  const [fields, setFields] = useState<Field[]>(preset ? ['plannedRR'] : [])
  const [values, setValues] = useState<Partial<Record<Field, string>>>({ plannedRR: '1.5' })
  const [deriveR, setDeriveR] = useState(false)
  const [sessions, setSessions] = useState(true)
  const mutation = useMutation({ mutationFn: (payload: BacktestingTradeBulkPayload) => updateBacktestingTrades(workspaceId, payload), onSuccess: onSaved })
  const toggle = (field: Field, checked: boolean) => setFields(current => checked ? [...current, field] : current.filter(item => item !== field))
  const numeric = (field: Field) => values[field]?.trim() ? Number(values[field]) : null
  const rr = fields.includes('plannedRR') ? numeric('plannedRR') : null
  const invalidNumber = fields.some(field => ['plannedRR', 'riskPercent', 'pnlR'].includes(field) && values[field]?.trim() && !Number.isFinite(Number(values[field])))
  const invalidR = fields.includes('pnlR') && trades.some(trade => {
    const r = numeric('pnlR')
    return r == null ? trade.netPnl == null : (trade.result === 'WIN' && r <= 0) || (trade.result === 'LOSS' && r >= 0) || (trade.result === 'BREAKEVEN' && r !== 0)
  })
  const invalidRR = fields.includes('plannedRR') && rr != null && rr <= 0
  const missingRR = deriveR && (fields.includes('plannedRR') ? rr == null || rr <= 0 : trades.some(trade => !trade.plannedRR || trade.plannedRR <= 0))
  const save = () => {
    const changes: Partial<BacktestingTradeBulkChanges> = {}
    for (const field of fields) {
      const value = values[field] || ''
      if (field === 'tags') changes.tags = value.split(',').map(tag => tag.trim()).filter(Boolean)
      else if (field === 'plannedRR' || field === 'riskPercent' || field === 'pnlR') changes[field] = numeric(field)
      else Object.assign(changes, { [field]: value.trim() || null })
    }
    mutation.mutate({ tradeIds: trades.map(trade => trade.id), fields, changes, deriveRFromPlannedRR: deriveR, recalculateSession: sessions })
  }
  const editor = (field: Field, label: string, number = false) => <Stack key={field} spacing={0.5}>
    <FormControlLabel control={<Checkbox checked={fields.includes(field)} disabled={mutation.isLoading || (field === 'pnlR' && deriveR)} onChange={event => toggle(field, event.target.checked)} />} label={t('backtesting.bulk.changeField', { field: label })} />
    {fields.includes(field) && <TextField fullWidth type={number ? 'number' : 'text'} label={label} value={values[field] || ''} disabled={mutation.isLoading} multiline={field === 'notes'} minRows={field === 'notes' ? 3 : undefined} inputProps={number ? { step: 'any' } : undefined} helperText={t('backtesting.bulk.clearHelp')} onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))} />}
  </Stack>
  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isLoading ? undefined : onClose} aria-labelledby="bulk-trade-title">
    <DialogTitle id="bulk-trade-title">{t('backtesting.bulk.title', { count: trades.length })}</DialogTitle>
    <DialogContent dividers><Stack spacing={1.5}>
      <Alert severity="info">{t('backtesting.bulk.description')}</Alert>
      {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : t('backtesting.bulk.error')}</Alert>}
      {editor('plannedRR', t('backtesting.trades.plannedRR'), true)}
      <FormControlLabel control={<Checkbox checked={deriveR} disabled={mutation.isLoading} onChange={event => { setDeriveR(event.target.checked); if (event.target.checked) setFields(current => current.filter(field => field !== 'pnlR')) }} />} label={t('backtesting.bulk.deriveR')} />
      <Typography variant="caption" color="text.secondary">{t('backtesting.bulk.deriveHelp')}</Typography>
      {missingRR && <Alert severity="warning">{t('backtesting.bulk.missingRR')}</Alert>}
      {editor('pnlR', t('backtesting.trades.rMultiple'), true)}
      {invalidR && <Alert severity="warning">{t('backtesting.errors.resultMismatch')}</Alert>}
      {editor('riskPercent', t('backtesting.trades.riskPercent'), true)}
      <FormControlLabel control={<Checkbox checked={sessions} disabled={mutation.isLoading} onChange={event => setSessions(event.target.checked)} />} label={t('backtesting.bulk.recalculateSession')} />
      <Typography variant="caption" color="text.secondary">{t('backtesting.bulk.sessionHelp')}</Typography>
      {editor('sourceTimezone', t('backtesting.replay.timezone'))}
      {editor('setupName', t('backtesting.bulk.setupName'))}
      {editor('strategyNameSnapshot', t('backtesting.bulk.strategyName'))}
      {textFields.map(([field, key]) => editor(field, t(`backtesting.trades.${key}`)))}
    </Stack></DialogContent>
    <DialogActions><Button disabled={mutation.isLoading} onClick={onClose}>{t('backtesting.actions.cancel')}</Button><Button variant="contained" disabled={mutation.isLoading || trades.length === 0 || trades.length > 500 || (!fields.length && !deriveR && !sessions) || invalidNumber || invalidRR || invalidR || missingRR} onClick={save}>{t(mutation.isLoading ? 'backtesting.actions.saving' : 'backtesting.bulk.apply', { count: trades.length })}</Button></DialogActions>
  </Dialog>
}
