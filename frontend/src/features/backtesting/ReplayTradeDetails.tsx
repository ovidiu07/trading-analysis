import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import IctMetadataDetails from './IctMetadataDetails'
import { formatMoney } from './ResearchPerformance'

export default function ReplayTradeDetails({ trade, onClose, onEdit }: { trade: BacktestingTrade; onClose: () => void; onEdit?: () => void }) {
  const { t, locale } = useI18n()
  const money = (value: number | null | undefined) => formatMoney(value, trade.currency, locale)
  const rows: Array<[string, unknown]> = [
    ['instrument', trade.instrument], ['entry', `${trade.date} ${trade.entryTime}`], ['exit', `${trade.exitDate || ''} ${trade.exitTime || ''}`],
    ['timezone', trade.sourceTimezone || t('backtesting.replay.unspecified')], ['priceCurrency', trade.priceCurrency || t('backtesting.replay.unspecified')],
    ['entryPrice', trade.entryPrice == null ? null : `${trade.entryPrice} ${trade.priceCurrency || ''}`], ['exitPrice', trade.exitPrice == null ? null : `${trade.exitPrice} ${trade.priceCurrency || ''}`],
    ['quantity', trade.quantity], ['positionValue', trade.positionValue], ['netPnl', money(trade.netPnl)], ['returnPercent', trade.returnPercent == null ? null : `${trade.returnPercent}%`],
    ['commission', money(trade.commission)], ['favorableExcursion', money(trade.favorableExcursion)], ['adverseExcursion', money(trade.adverseExcursion)],
    ['mfePercent', trade.favorableExcursionPercent == null ? null : `${trade.favorableExcursionPercent}%`], ['maePercent', trade.adverseExcursionPercent == null ? null : `${trade.adverseExcursionPercent}%`],
    ['durationBars', trade.durationBars], ['entrySignal', trade.entrySignal], ['exitSignal', trade.exitSignal],
    ['reportedCumulativePnl', money(trade.reportedCumulativePnl)], ['reportedCumulativePercent', trade.reportedCumulativePercent == null ? null : `${trade.reportedCumulativePercent}%`],
    ['file', trade.importFileName], ['tradeNumber', trade.importTradeNumber], ['scope', trade.tradeScope]
  ]
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: theme => ({ bgcolor: alpha(theme.palette.background.paper, 1) }) }} aria-labelledby="replay-trade-title"><DialogTitle id="replay-trade-title">{t('backtesting.replay.details')}</DialogTitle><DialogContent dividers>{trade.importFormat && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('backtesting.replay.detailCaveats')}</Typography>}<Table size="small"><TableBody>{rows.filter(([key, value]) => trade.importFormat || ['instrument', 'entry', 'timezone', 'scope'].includes(key) || (value != null && value !== '' && value !== '—')).map(([key, value]) => <TableRow key={key}><TableCell component="th" scope="row">{t(`backtesting.replay.${key}`)}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{String(value ?? '—')}</TableCell></TableRow>)}</TableBody></Table><IctMetadataDetails trade={trade} /></DialogContent><DialogActions>{onEdit && <Button onClick={onEdit}>{t('backtesting.actions.edit')}</Button>}<Button onClick={onClose}>{t('backtesting.replay.done')}</Button></DialogActions></Dialog>
}
