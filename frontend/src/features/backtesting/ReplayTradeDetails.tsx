import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material'
import type { BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { formatMoney } from './ResearchPerformance'

export default function ReplayTradeDetails({ trade, onClose }: { trade: BacktestingTrade; onClose: () => void }) {
  const { t, locale } = useI18n()
  const money = (value: number | null | undefined) => formatMoney(value, trade.currency, locale)
  const rows: Array<[string, unknown]> = [
    ['instrument', trade.instrument], ['entry', `${trade.date} ${trade.entryTime}`], ['exit', `${trade.exitDate || ''} ${trade.exitTime || ''}`],
    ['timezone', trade.sourceTimezone || t('backtesting.replay.unspecified')], ['entryPrice', trade.entryPrice], ['exitPrice', trade.exitPrice],
    ['quantity', trade.quantity], ['positionValue', money(trade.positionValue)], ['netPnl', money(trade.netPnl)], ['returnPercent', trade.returnPercent == null ? null : `${trade.returnPercent}%`],
    ['commission', money(trade.commission)], ['favorableExcursion', money(trade.favorableExcursion)], ['adverseExcursion', money(trade.adverseExcursion)],
    ['mfePercent', trade.favorableExcursionPercent == null ? null : `${trade.favorableExcursionPercent}%`], ['maePercent', trade.adverseExcursionPercent == null ? null : `${trade.adverseExcursionPercent}%`],
    ['durationBars', trade.durationBars], ['entrySignal', trade.entrySignal], ['exitSignal', trade.exitSignal],
    ['reportedCumulativePnl', money(trade.reportedCumulativePnl)], ['reportedCumulativePercent', trade.reportedCumulativePercent == null ? null : `${trade.reportedCumulativePercent}%`],
    ['file', trade.importFileName], ['tradeNumber', trade.importTradeNumber], ['scope', trade.tradeScope]
  ]
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="replay-trade-title"><DialogTitle id="replay-trade-title">{t('backtesting.replay.details')}</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('backtesting.replay.detailCaveats')}</Typography><Table size="small"><TableBody>{rows.map(([key, value]) => <TableRow key={key}><TableCell component="th" scope="row">{t(`backtesting.replay.${key}`)}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{String(value ?? '—')}</TableCell></TableRow>)}</TableBody></Table></DialogContent><DialogActions><Button onClick={onClose}>{t('backtesting.replay.done')}</Button></DialogActions></Dialog>
}
