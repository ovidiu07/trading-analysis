import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import type { BacktestingEdgeLens, BacktestingScreenshot, BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import type { ResearchFilters } from './research'
import { buildBacktestingReport, downloadExport, exportFilename, reportArchive, rowsToCsv, selectExportTrades, tradeExportRows, validExportDate, type ExportPeriod } from './export'

type Props = {
  workspace: BacktestingWorkspace
  trades: BacktestingTrade[]
  filters: ResearchFilters
  lenses: BacktestingEdgeLens[]
  screenshots: BacktestingScreenshot[]
  reportLoading: boolean
  reportError: boolean
  onRetry: () => void
  onClose: () => void
  onExported: (message: string) => void
}

export default function ExportBacktestingDialog({ workspace, trades, filters, lenses, screenshots, reportLoading, reportError, onRetry, onClose, onExported }: Props) {
  const { t } = useI18n()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dates = trades.filter(trade => trade.workspaceId === workspace.id && trade.source !== 'LIVE' && trade.tradeScope !== 'LIVE').map(trade => trade.date).sort()
  const [from, setFrom] = useState(filters.dateFrom || dates[0] || '')
  const [to, setTo] = useState(filters.dateTo || dates[dates.length - 1] || '')
  const [dateBasis, setDateBasis] = useState<ExportPeriod['dateBasis']>('entry')
  const [format, setFormat] = useState<'zip' | 'csv'>('zip')
  const [applyFilters, setApplyFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const valid = validExportDate(from) && validExportDate(to) && from <= to
  const period = useMemo<ExportPeriod>(() => ({ from, to, dateBasis, filters: applyFilters ? filters : undefined }), [from, to, dateBasis, applyFilters, filters])
  const selected = useMemo(() => valid ? selectExportTrades(trades, workspace.id, period) : [], [trades, workspace.id, period, valid])
  const analyzedCount = selected.filter(trade => trade.includedInAnalytics !== false).length
  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== 'dateFrom' && key !== 'dateTo' && Boolean(value))
  const exportData = async () => {
    setExporting(true)
    setError('')
    try {
      // Let the browser paint progress before constructing a potentially large report.
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
      if (format === 'csv') downloadExport(rowsToCsv(tradeExportRows(selected)), exportFilename(workspace, period, 'csv'), 'text/csv;charset=utf-8')
      else {
        const files = buildBacktestingReport(workspace, trades, period, lenses, screenshots)
        downloadExport(reportArchive(files), exportFilename(workspace, period, 'zip'), 'application/zip')
      }
      onExported(t('backtesting.export.success', { count: selected.length }))
      onClose()
    } catch {
      setError(t('backtesting.export.failed'))
    } finally { setExporting(false) }
  }
  return <Dialog open onClose={exporting ? undefined : onClose} fullScreen={mobile} fullWidth maxWidth="sm" aria-labelledby="backtesting-export-title"
    PaperProps={{ sx: { bgcolor: theme.palette.mode === 'light' ? 'common.white' : 'background.default' } }}>
    <DialogTitle id="backtesting-export-title">{t('backtesting.export.title')}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t('backtesting.export.description')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField fullWidth type="date" label={t('backtesting.export.from')} value={from} onChange={event => setFrom(event.target.value)} InputLabelProps={{ shrink: true }} disabled={exporting} />
          <TextField fullWidth type="date" label={t('backtesting.export.to')} value={to} onChange={event => setTo(event.target.value)} InputLabelProps={{ shrink: true }} disabled={exporting} />
        </Stack>
        <TextField select fullWidth label={t('backtesting.export.dateBasis')} value={dateBasis} onChange={event => setDateBasis(event.target.value as ExportPeriod['dateBasis'])} disabled={exporting}>
          <MenuItem value="entry">{t('backtesting.export.entryDate')}</MenuItem><MenuItem value="exit">{t('backtesting.export.exitDate')}</MenuItem>
        </TextField>
        {dateBasis === 'exit' && <Typography variant="caption" color="text.secondary">{t('backtesting.export.exitNotice')}</Typography>}
        <TextField select fullWidth label={t('backtesting.export.format')} value={format} onChange={event => setFormat(event.target.value as 'zip' | 'csv')} disabled={exporting}>
          <MenuItem value="zip">{t('backtesting.export.bundle')}</MenuItem><MenuItem value="csv">{t('backtesting.export.tradesOnly')}</MenuItem>
        </TextField>
        {activeFilters.length > 0 && <FormControlLabel control={<Checkbox checked={applyFilters} onChange={event => setApplyFilters(event.target.checked)} disabled={exporting} />} label={t('backtesting.export.applyFilters', { count: activeFilters.length })} />}
        <Typography variant="body2">{t('backtesting.export.scope')}</Typography>
        {valid ? <Alert severity={selected.length ? 'info' : 'warning'}>{selected.length ? t('backtesting.export.preview', { total: selected.length, analyzed: analyzedCount, excluded: selected.length - analyzedCount }) : t('backtesting.export.empty')}</Alert>
          : <Alert severity="warning">{t('backtesting.export.invalidPeriod')}</Alert>}
        {format === 'zip' && <Typography variant="body2" color="text.secondary">{t('backtesting.export.contents')}</Typography>}
        <Typography variant="body2" color="text.secondary">{t('backtesting.export.stopTargetNotice')}</Typography>
        {format === 'zip' && reportLoading && <Typography role="status" variant="body2">{t('backtesting.export.loading')}</Typography>}
        {format === 'zip' && reportError && <Alert severity="error" action={<Button color="inherit" onClick={onRetry}>{t('common.retry')}</Button>}>{t('backtesting.export.reportError')}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
      <Button onClick={onClose} disabled={exporting}>{t('common.cancel')}</Button>
      <Button variant="contained" onClick={() => void exportData()} disabled={!valid || !selected.length || exporting || (format === 'zip' && (reportLoading || reportError))}>
        {t(exporting ? 'backtesting.export.exporting' : 'backtesting.export.download')}
      </Button>
    </DialogActions>
  </Dialog>
}
