import { useState } from 'react'
import { MenuItem, TextField } from '@mui/material'
import { detachBacktestingScreenshotTrade, updateBacktestingScreenshot, type BacktestingScreenshot, type BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'

// The existing screenshot update endpoint replaces these fields, so preserve them on a link/category edit.
export const screenshotMetadata = (screenshot: BacktestingScreenshot) => ({
  caption: screenshot.caption, tradeResult: screenshot.tradeResult, session: screenshot.session,
  timeframe: screenshot.timeframe, tags: screenshot.tags, sortOrder: screenshot.sortOrder,
  backtestingTradeId: screenshot.backtestingTradeId
})

export default function ScreenshotTradeLink({ screenshot, trades, onSaved, onError }: {
  screenshot: BacktestingScreenshot; trades: BacktestingTrade[]
  onSaved: () => Promise<void>; onError: (error: unknown, key: string) => void
}) {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const candidates = trades.filter(trade => trade.workspaceId === screenshot.workspaceId && trade.source !== 'LIVE' && trade.tradeScope !== 'LIVE')
  const update = async (tradeId: string) => {
    setSaving(true)
    try {
      if (tradeId) await updateBacktestingScreenshot(screenshot.id, { ...screenshotMetadata(screenshot), backtestingTradeId: tradeId })
      else await detachBacktestingScreenshotTrade(screenshot.id)
      await onSaved()
    } catch (error) { onError(error, 'backtesting.errors.screenshotSave') }
    finally { setSaving(false) }
  }
  return <TextField select fullWidth size="small" label={t('backtesting.evidence.tradeLink')} value={screenshot.backtestingTradeId || ''}
    disabled={saving} onChange={event => void update(event.target.value)}>
    <MenuItem value="">{t('backtesting.evidence.workspaceEvidence')}</MenuItem>
    {candidates.map(trade => <MenuItem key={trade.id} value={trade.id}>
      {trade.date} {trade.entryTime} · {trade.instrument} · {trade.direction} · {trade.id.slice(0, 8)}
    </MenuItem>)}
  </TextField>
}
