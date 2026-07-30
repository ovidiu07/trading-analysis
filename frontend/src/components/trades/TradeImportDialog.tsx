import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Grid, MenuItem, Paper, Stack, Step, StepLabel, Stepper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme
} from '@mui/material'
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded'
import {
  fetchTradingAccounts, type TradingAccountOption
} from '../../api/accounts'
import {
  commitMt5Import, commitTrading212Import, previewMt5Import, previewTrading212Import,
  type Mt5ImportCommitResult, type Mt5ImportPreview,
  type Mt5SymbolMapping
} from '../../api/tradeImports'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n'
import { formatCurrency, formatDateTime } from '../../utils/format'
import TradingAccountSelector from '../accounts/TradingAccountSelector'

type Props = {
  open: boolean
  userTimezone: string
  onClose: () => void
  onTradovate: () => void
  onCommitted: () => void
}

const markets: Mt5SymbolMapping['market'][] = ['STOCK', 'CFD', 'FOREX', 'FUTURES', 'CRYPTO', 'OPTIONS', 'OTHER']
const tradeSelectionId = (trade: Mt5ImportPreview['trades'][number]) =>
  trade.externalTradeId || trade.externalOrderId || trade.externalPositionId

const initialTargetAccountId = (accounts: TradingAccountOption[], mappedAccountId?: string | null) => {
  if (mappedAccountId && accounts.some((account) => account.id === mappedAccountId)) return mappedAccountId
  return accounts.length === 1 ? accounts[0].id : ''
}

export default function TradeImportDialog({ open, userTimezone, onClose, onTradovate, onCommitted }: Props) {
  const { t } = useI18n()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [provider, setProvider] = useState<'MT5' | 'TRADING212' | null>(null)
  const [step, setStep] = useState(0)
  const [preview, setPreview] = useState<Mt5ImportPreview | null>(null)
  const [result, setResult] = useState<Mt5ImportCommitResult | null>(null)
  const [filename, setFilename] = useState('')
  const [accounts, setAccounts] = useState<TradingAccountOption[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState(false)
  const [targetAccountId, setTargetAccountId] = useState('')
  const accountRequestId = useRef(0)
  const [sourceTimezone, setSourceTimezone] = useState('')
  const [saveTimezone, setSaveTimezone] = useState(true)
  const [mappings, setMappings] = useState<Record<string, Mt5SymbolMapping>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [links, setLinks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    accountRequestId.current += 1
    setProvider(null); setStep(0); setPreview(null); setResult(null); setFilename(''); setTargetAccountId('')
    setSourceTimezone(''); setMappings({}); setSelected(new Set()); setLinks({}); setError(''); setLoading(false)
    setAccounts([]); setAccountsLoading(false); setAccountsError(false)
  }

  const loadAccounts = async (
    preferredAccountId?: string | null,
    optimisticAccount?: TradingAccountOption
  ) => {
    const requestId = ++accountRequestId.current
    setAccountsLoading(true)
    setAccountsError(false)
    try {
      const items = await fetchTradingAccounts()
      if (requestId !== accountRequestId.current) return
      const nextItems = optimisticAccount && !items.some((account) => account.id === optimisticAccount.id)
        ? [...items, optimisticAccount]
        : items
      setAccounts(nextItems)
      setTargetAccountId((current) => {
        if (current && nextItems.some((account) => account.id === current)) return current
        return initialTargetAccountId(nextItems, preferredAccountId)
      })
    } catch {
      if (requestId !== accountRequestId.current) return
      setAccounts([])
      setAccountsError(true)
      setTargetAccountId('')
    } finally {
      if (requestId === accountRequestId.current) setAccountsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadAccounts()
    return () => { accountRequestId.current += 1 }
    // Account loading intentionally follows the dialog lifecycle, not preview state.
  }, [open])

  const handleClose = () => { reset(); onClose() }

  const handleFile = async (file?: File) => {
    if (!file) return
    setError(''); setLoading(true); setFilename(file.name)
    try {
      const preferredAccountId = targetAccountId || (accounts.length === 1 ? accounts[0].id : '')
      if (provider === 'TRADING212' && !preferredAccountId) {
        setError(t('trades.mt5.accounts.requiredBeforeUpload'))
        return
      }
      const next = provider === 'TRADING212'
        ? await previewTrading212Import(file, preferredAccountId)
        : await previewMt5Import(file)
      setPreview(next)
      setTargetAccountId(initialTargetAccountId(accounts, next.targetAccountId))
      setSourceTimezone(next.sourceTimezone || '')
      setSelected(new Set(next.trades.map(tradeSelectionId)))
      const initialMappings: Record<string, Mt5SymbolMapping> = {}
      next.trades.forEach((trade) => {
        if (!initialMappings[trade.externalSymbol]) {
          initialMappings[trade.externalSymbol] = {
            externalSymbol: trade.externalSymbol,
            internalSymbol: trade.mappedSymbol || (provider === 'TRADING212' ? trade.externalSymbol : ''),
            market: trade.market || 'CFD',
            tradeCurrency: trade.tradeCurrency || trade.instrumentCurrency || '',
            saveForFuture: true
          }
        }
      })
      setMappings(initialMappings)
      setStep(1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('trades.mt5.errors.preview'))
    } finally { setLoading(false) }
  }

  const mappingComplete = useMemo(() => Object.values(mappings).every((m) => m.internalSymbol.trim() && m.tradeCurrency.trim()), [mappings])
  const selectedAccount = accounts.find((account) => account.id === targetAccountId)
  const configurationComplete = Boolean(selectedAccount
    && (provider === 'TRADING212' || sourceTimezone.trim())
    && !accountsLoading && !accountsError)
  const selectedTrades = preview?.trades.filter((trade) => selected.has(tradeSelectionId(trade))) || []
  const totals = selectedTrades.reduce((sum, trade) => ({
    gross: sum.gross + (trade.grossPnl || 0),
    costs: sum.costs + (trade.commission || 0) + (trade.otherCosts || 0),
    net: sum.net + (trade.netPnl || 0)
  }), { gross: 0, costs: 0, net: 0 })

  const updateMapping = (symbol: string, patch: Partial<Mt5SymbolMapping>) => {
    setMappings((current) => ({ ...current, [symbol]: { ...current[symbol], ...patch } }))
  }

  const commit = async () => {
    if (!preview) return
    if (!selectedAccount) {
      setError(t('trades.mt5.accounts.invalidSelection'))
      setStep(1)
      return
    }
    setLoading(true); setError('')
    try {
      const committed = provider === 'TRADING212'
        ? await commitTrading212Import(preview.importBatchId, {
          targetAccountId,
          selectedExternalTradeIds: [...selected],
          symbolMappings: Object.values(mappings),
          linkToExistingTradeIds: links
        })
        : await commitMt5Import(preview.importBatchId, {
          targetAccountId,
          selectedPositionIds: [...selected],
          symbolMappings: Object.values(mappings),
          linkToExistingTradeIds: links,
          sourceTimezone: sourceTimezone.trim(),
          saveBrokerTimezone: saveTimezone
        })
      setResult(committed); setStep(5); onCommitted()
    } catch (cause) {
      const apiError = cause as ApiError
      setError(apiError instanceof Error ? apiError.message : t('trades.mt5.errors.commit'))
    } finally { setLoading(false) }
  }

  const stepLabels = [
    t('trades.mt5.steps.upload'), t('trades.mt5.steps.account'), t('trades.mt5.steps.mapping'),
    t('trades.mt5.steps.preview'), t('trades.mt5.steps.confirm'), t('trades.mt5.steps.result')
  ]

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xl" fullScreen={fullScreen}>
      <DialogTitle>{t('trades.mt5.title')}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: { sm: 520 } }}>
        {!provider ? (
          <Stack spacing={2}>
            <Typography>{t('trades.mt5.chooseProvider')}</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6">{t('trades.mt5.providerTradovate')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>{t('trades.mt5.tradovateDescription')}</Typography>
                  <Button variant="outlined" onClick={() => { handleClose(); onTradovate() }}>{t('trades.mt5.chooseTradovate')}</Button>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6">{t('trades.mt5.providerMt5')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>{t('trades.mt5.mt5Description')}</Typography>
                  <Button variant="contained" onClick={() => setProvider('MT5')}>{t('trades.mt5.chooseMt5')}</Button>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6">{t('trades.mt5.providerTrading212')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>{t('trades.mt5.trading212Description')}</Typography>
                  <Button variant="contained" onClick={() => setProvider('TRADING212')}>{t('trades.mt5.chooseTrading212')}</Button>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Stepper activeStep={step} alternativeLabel={!fullScreen} orientation={fullScreen ? 'vertical' : 'horizontal'}>
              {stepLabels.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>
            {error && <Alert severity="error">{error}</Alert>}
            {step === 0 && (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <FileUploadRoundedIcon color="primary" sx={{ fontSize: 44 }} />
                <Typography variant="h6">{t(provider === 'TRADING212' ? 'trades.mt5.trading212UploadTitle' : 'trades.mt5.uploadTitle')}</Typography>
                <Typography color="text.secondary">{t(provider === 'TRADING212' ? 'trades.mt5.trading212UploadHint' : 'trades.mt5.uploadHint')}</Typography>
                {provider === 'TRADING212' && (
                  <Box sx={{ maxWidth: 560, mx: 'auto', mt: 2, textAlign: 'left' }}>
                    <TradingAccountSelector
                      value={targetAccountId || null}
                      onChange={(accountId) => setTargetAccountId(accountId || '')}
                      accounts={accounts}
                      loading={accountsLoading}
                      error={accountsError}
                      onRetry={() => { void loadAccounts() }}
                      onAccountsChanged={(savedAccount) => loadAccounts(
                        savedAccount?.id || targetAccountId,
                        savedAccount
                      )}
                      required
                      context="import"
                      suggestedCurrency="EUR"
                    />
                  </Box>
                )}
                {filename && <Chip label={filename} sx={{ my: 2 }} />}
                <Box sx={{ mt: 2 }}><Button variant="contained" disabled={loading || (provider === 'TRADING212' && !targetAccountId)} onClick={() => inputRef.current?.click()}>{loading ? t('trades.mt5.parsing') : t('trades.mt5.selectFile')}</Button></Box>
                <input ref={inputRef} type="file" hidden
                  accept={provider === 'TRADING212' ? '.csv,text/csv' : '.html,.htm,text/html'}
                  onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = '' }} />
              </Paper>
            )}
            {step === 1 && preview && (
              <Stack spacing={2}>
                <Alert severity="info">{t(provider === 'TRADING212'
                  ? 'trades.mt5.trading212AccountNotice'
                  : 'trades.mt5.brokerTimezoneWarning')}</Alert>
                <Grid container spacing={2}>
                  {Object.entries(preview.account).map(([key, value]) => value ? <Grid item xs={12} sm={6} md={3} key={key}><Typography variant="caption" color="text.secondary">{t(`trades.mt5.account.${key}`)}</Typography><Typography>{value}</Typography></Grid> : null)}
                </Grid>
                <Divider />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TradingAccountSelector
                      value={targetAccountId || null}
                      onChange={(accountId) => setTargetAccountId(accountId || '')}
                      accounts={accounts}
                      loading={accountsLoading}
                      error={accountsError}
                      onRetry={() => { void loadAccounts(preview.targetAccountId) }}
                      onAccountsChanged={(savedAccount) => loadAccounts(
                        savedAccount?.id || targetAccountId,
                        savedAccount
                      )}
                      required
                      context="import"
                      suggestedCurrency={preview.account.currency || 'USD'}
                    />
                  </Grid>
                  {provider === 'MT5' && <Grid item xs={12} md={6}><TextField fullWidth label={t('trades.mt5.sourceTimezone')} placeholder="Europe/London" value={sourceTimezone} onChange={(e) => setSourceTimezone(e.target.value)} helperText={t('trades.mt5.timezoneHint')} /></Grid>}
                </Grid>
                {provider === 'MT5' && <FormControlLabel control={<Checkbox checked={saveTimezone} onChange={(e) => setSaveTimezone(e.target.checked)} />} label={t('trades.mt5.saveTimezone')} />}
                {provider === 'TRADING212' && selectedAccount?.currency && preview.account.currency
                  && selectedAccount.currency.toUpperCase() !== preview.account.currency.toUpperCase()
                  && <Alert severity="warning">{t('trades.mt5.currencyMismatch', {
                    source: preview.account.currency, target: selectedAccount.currency
                  })}</Alert>}
              </Stack>
            )}
            {step === 2 && preview && (
              <Stack spacing={2}>
                {Object.values(mappings).map((mapping) => (
                  <Paper variant="outlined" sx={{ p: 2 }} key={mapping.externalSymbol}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {mapping.externalSymbol}
                      {provider === 'TRADING212' && preview.unmappedSymbols.find((item) => item.externalSymbol === mapping.externalSymbol)?.externalInstrument
                        ? ` — ${preview.unmappedSymbols.find((item) => item.externalSymbol === mapping.externalSymbol)?.externalInstrument}`
                        : ''}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}><TextField fullWidth required label={t('trades.mt5.internalSymbol')} value={mapping.internalSymbol} onChange={(e) => updateMapping(mapping.externalSymbol, { internalSymbol: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6} md={3}><TextField select fullWidth label={t('trades.mt5.market')} value={mapping.market} onChange={(e) => updateMapping(mapping.externalSymbol, { market: e.target.value as Mt5SymbolMapping['market'] })}>{markets.map((market) => <MenuItem key={market} value={market}>{market}</MenuItem>)}</TextField></Grid>
                      <Grid item xs={12} sm={6} md={3}><TextField fullWidth required label={t('trades.mt5.tradeCurrency')} value={mapping.tradeCurrency} onChange={(e) => updateMapping(mapping.externalSymbol, { tradeCurrency: e.target.value.toUpperCase() })} /></Grid>
                      <Grid item xs={12} sm={6} md={3}><TextField fullWidth type="number" label={t('trades.mt5.contractMultiplier')} value={mapping.contractMultiplier ?? ''} onChange={(e) => updateMapping(mapping.externalSymbol, { contractMultiplier: e.target.value ? Number(e.target.value) : null })} /></Grid>
                      <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={t('trades.mt5.tickSize')} value={mapping.tickSize ?? ''} onChange={(e) => updateMapping(mapping.externalSymbol, { tickSize: e.target.value ? Number(e.target.value) : null })} /></Grid>
                      <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={t('trades.mt5.tickValue')} value={mapping.tickValue ?? ''} onChange={(e) => updateMapping(mapping.externalSymbol, { tickValue: e.target.value ? Number(e.target.value) : null })} /></Grid>
                      <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={t('trades.mt5.pointValue')} value={mapping.pointValue ?? ''} onChange={(e) => updateMapping(mapping.externalSymbol, { pointValue: e.target.value ? Number(e.target.value) : null })} /></Grid>
                    </Grid>
                    <FormControlLabel control={<Checkbox checked={mapping.saveForFuture} onChange={(e) => updateMapping(mapping.externalSymbol, { saveForFuture: e.target.checked })} />} label={t('trades.mt5.saveMapping')} />
                  </Paper>
                ))}
              </Stack>
            )}
            {step === 3 && preview && (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 430 }}>
                <Table stickyHeader size="small" sx={{ minWidth: 1500 }}>
                  <TableHead><TableRow>
                    <TableCell>{t('trades.mt5.include')}</TableCell><TableCell>{t('trades.mt5.importState')}</TableCell>
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.externalPositionId')}</TableCell>}
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.externalOrderId')}</TableCell>}
                    <TableCell>{t('trades.table.symbol')}</TableCell><TableCell>{t('trades.table.direction')}</TableCell><TableCell>{t('trades.table.status')}</TableCell><TableCell>{t('trades.table.opened')}</TableCell><TableCell>{t('trades.mt5.closed')}</TableCell><TableCell>{t('trades.table.qty')}</TableCell><TableCell>{t('trades.table.entry')}</TableCell><TableCell>{t('trades.table.exit')}</TableCell><TableCell>SL / TP</TableCell>
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.exchangeRate')}</TableCell>}
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.reportedSpread')}</TableCell>}
                    <TableCell>{t('trades.mt5.gross')}</TableCell>
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.fxFee')}</TableCell>}
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.overnightInterest')}</TableCell>}
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.dividendAdjustment')}</TableCell>}
                    {provider === 'MT5' && <TableCell>{t('trades.form.commission')}</TableCell>}
                    <TableCell>{t('trades.mt5.net')}</TableCell><TableCell>{t('trades.mt5.manualMatch')}</TableCell><TableCell>{t('trades.mt5.warnings')}</TableCell>
                    {provider === 'TRADING212' && <TableCell>{t('trades.mt5.sourceRow')}</TableCell>}
                  </TableRow></TableHead>
                  <TableBody>{preview.trades.map((trade) => (
                    <TableRow key={tradeSelectionId(trade)}>
                      <TableCell><Checkbox checked={selected.has(tradeSelectionId(trade))} onChange={(e) => setSelected((current) => { const next = new Set(current); e.target.checked ? next.add(tradeSelectionId(trade)) : next.delete(tradeSelectionId(trade)); return next })} /></TableCell>
                      <TableCell><Chip size="small" color={trade.duplicate ? 'warning' : 'success'} label={trade.duplicate ? t('trades.mt5.existing') : t('trades.mt5.newTrade')} /></TableCell>
                      {provider === 'TRADING212' && <TableCell>{trade.externalPositionId}</TableCell>}
                      {provider === 'TRADING212' && <TableCell>{trade.externalOrderId || '—'}</TableCell>}
                      <TableCell>{trade.externalSymbol} → {mappings[trade.externalSymbol]?.internalSymbol}</TableCell><TableCell>{trade.direction}</TableCell><TableCell>{trade.status}</TableCell>
                      <TableCell>{trade.openedAt ? formatDateTime(trade.openedAt, userTimezone) : '—'}</TableCell><TableCell>{trade.closedAt ? formatDateTime(trade.closedAt, userTimezone) : '—'}</TableCell>
                      <TableCell>{trade.quantity}</TableCell><TableCell>{trade.entryPrice}</TableCell><TableCell>{trade.exitPrice ?? '—'}</TableCell><TableCell>{trade.initialStopLossPrice ?? '—'} / {trade.initialTakeProfitPrice ?? '—'}</TableCell>
                      {provider === 'TRADING212' && <TableCell>{trade.sourceExchangeRate ?? '—'}</TableCell>}
                      {provider === 'TRADING212' && <TableCell>{formatCurrency(trade.reportedSpread, trade.accountCurrency || 'USD')}</TableCell>}
                      <TableCell>{formatCurrency(trade.grossPnl, trade.accountCurrency || 'USD')}</TableCell>
                      {provider === 'TRADING212' && <TableCell>{formatCurrency(trade.fxFee, trade.accountCurrency || 'USD')}</TableCell>}
                      {provider === 'TRADING212' && <TableCell>{formatCurrency(trade.overnightInterest, trade.accountCurrency || 'USD')}</TableCell>}
                      {provider === 'TRADING212' && <TableCell>{formatCurrency(trade.dividendAdjustment, trade.accountCurrency || 'USD')}</TableCell>}
                      {provider === 'MT5' && <TableCell>{formatCurrency(trade.commission, trade.accountCurrency || 'USD')}</TableCell>}
                      <TableCell>{formatCurrency(trade.netPnl, trade.accountCurrency || 'USD')}</TableCell>
                      <TableCell>{trade.potentialManualMatches.length ? <TextField select size="small" value={links[tradeSelectionId(trade)] || ''} onChange={(e) => setLinks((current) => ({ ...current, [tradeSelectionId(trade)]: e.target.value }))}><MenuItem value="">{t('trades.mt5.importAsNew')}</MenuItem>{trade.potentialManualMatches.map((match) => <MenuItem value={match.tradeId} key={match.tradeId}>{t('trades.mt5.linkMatch', { symbol: match.symbol, confidence: match.confidence })}</MenuItem>)}</TextField> : '—'}</TableCell>
                      <TableCell><Typography variant="caption">{trade.warnings.join(' • ') || '—'}</Typography></TableCell>
                      {provider === 'TRADING212' && <TableCell>
                        <Box component="details">
                          <Box component="summary" sx={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('trades.mt5.inspectSourceRow')}</Box>
                          <Box component="pre" sx={{ m: 0, mt: 1, maxWidth: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11 }}>
                            {JSON.stringify(trade.rawSource || {}, null, 2)}
                          </Box>
                        </Box>
                      </TableCell>}
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableContainer>
            )}
            {step === 4 && preview && (
              <Stack spacing={2}>
                <Alert severity={preview.summary.warnings ? 'warning' : 'success'}>{t('trades.mt5.confirmMessage')}</Alert>
                <Grid container spacing={2}>{[
                  [t('trades.mt5.selectedTrades'), selected.size], [t('trades.mt5.newTrades'), selectedTrades.filter((trade) => !trade.duplicate).length],
                  [t('trades.mt5.updates'), selectedTrades.filter((trade) => trade.duplicate).length], [t('trades.mt5.excluded'), preview.trades.length - selected.size]
                ].map(([label, value]) => <Grid item xs={6} md={3} key={String(label)}><Paper variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h5">{value}</Typography></Paper></Grid>)}</Grid>
                <Typography>
                  {t('trades.mt5.targetAccount')}: {selectedAccount
                    ? [selectedAccount.name, selectedAccount.broker, selectedAccount.currency].filter(Boolean).join(' — ')
                    : t('trades.mt5.accounts.placeholder')}
                </Typography>
                <Typography>{t('trades.mt5.totalGross')}: {formatCurrency(totals.gross, preview.account.currency || 'USD')}</Typography>
                <Typography>{t('trades.mt5.totalCosts')}: {formatCurrency(totals.costs, preview.account.currency || 'USD')}</Typography>
                <Typography>{t('trades.mt5.totalNet')}: {formatCurrency(totals.net, preview.account.currency || 'USD')}</Typography>
                {provider === 'TRADING212' && <Alert severity="info">{t('trades.mt5.spreadInformational', {
                  spread: formatCurrency(preview.summary.reportedSpread, preview.account.currency || 'USD')
                })}</Alert>}
                {provider === 'TRADING212' && Boolean(preview.unsupportedRows?.length)
                  && (
                    <Alert severity="warning">
                      <Typography variant="body2">
                        {t('trades.mt5.rowIssues', { count: preview.unsupportedRows?.length || 0 })}
                      </Typography>
                      <Stack component="ul" spacing={0.5} sx={{ m: 0, mt: 1, pl: 2.5 }}>
                        {preview.unsupportedRows?.map((row) => (
                          <Typography component="li" variant="caption" key={row.rowNumber}>
                            {t('trades.mt5.rowIssue', {
                              row: row.rowNumber,
                              reason: [...(row.errors || []), ...(row.warnings || [])].join(' • ')
                            })}
                          </Typography>
                        ))}
                      </Stack>
                    </Alert>
                  )}
              </Stack>
            )}
            {step === 5 && result && (
              <Stack spacing={2}>
                <Alert severity={result.errors.length ? 'error' : result.created === 0 && provider === 'TRADING212' ? 'info' : 'success'}>
                  {provider === 'TRADING212' && result.created === 0
                    ? t('trades.mt5.allAlreadyImported')
                    : t(provider === 'TRADING212' ? 'trades.mt5.trading212Complete' : 'trades.mt5.complete')}
                </Alert>
                {result.originalFilename && <Typography>{t('trades.mt5.fileName')}: {result.originalFilename}</Typography>}
                {result.targetAccountName && <Typography>{t('trades.mt5.targetAccount')}: {result.targetAccountName}</Typography>}
                {result.totalRows != null && <Typography>{t('trades.mt5.csvRows')}: {result.totalRows}</Typography>}
                <Typography>{t('trades.mt5.created')}: {result.created}</Typography>
                <Typography>{t('trades.mt5.updated')}: {result.updated}</Typography>
                <Typography>{t('trades.mt5.duplicates')}: {result.duplicatesSkipped}</Typography>
                {result.duplicatesInFile != null && <Typography>{t('trades.mt5.duplicatesInFile')}: {result.duplicatesInFile}</Typography>}
                {result.invalidRows != null && <Typography>{t('trades.mt5.invalidRows')}: {result.invalidRows}</Typography>}
                {result.failedRows != null && <Typography>{t('trades.mt5.failedRows')}: {result.failedRows}</Typography>}
                <Typography>{t('trades.mt5.resultNet')}: {formatCurrency(result.netPnl, preview?.account.currency || 'USD')}</Typography>
                {result.skippedNetPnl != null && <Typography>{t('trades.mt5.skippedNet')}: {formatCurrency(result.skippedNetPnl, preview?.account.currency || 'USD')}</Typography>}
                {result.warnings.length > 0 && <Alert severity="warning">{result.warnings.join(' • ')}</Alert>}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{step === 5 ? t('common.close') : t('common.cancel')}</Button>
        {provider && step > 0 && step < 5 && <Button onClick={() => setStep((current) => current - 1)}>{t('common.back')}</Button>}
        {provider && step === 1 && <Button variant="contained" disabled={!configurationComplete} onClick={() => setStep(2)}>{t('common.next')}</Button>}
        {provider && step === 2 && <Button variant="contained" disabled={!mappingComplete} onClick={() => setStep(3)}>{t('common.next')}</Button>}
        {provider && step === 3 && <Button variant="contained" disabled={!selected.size} onClick={() => setStep(4)}>{t('common.next')}</Button>}
        {provider && step === 4 && <Button variant="contained" disabled={loading || !selected.size} onClick={() => void commit()}>{loading ? t('trades.mt5.importing') : t('trades.mt5.commit')}</Button>}
      </DialogActions>
    </Dialog>
  )
}
