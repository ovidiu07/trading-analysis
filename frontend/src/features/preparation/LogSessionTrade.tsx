import { announceAnalyticsDataChanged } from '../../api/dataEvents'
import { useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { TradeForm } from '../../components/trades/TradeForm'
import { TradeFormValues, buildTradePayload } from '../../utils/tradePayload'
import { apiPost } from '../../api/client'
import { useAccountScope } from '../accountScope/useAccountScope'
import { useI18n } from '../../i18n'
import { SessionReview } from '../../api/sessionReviews'
import { StrategyResponse } from '../../api/strategies'
import { formatInTimeZone } from 'date-fns-tz'

export function LogSessionTrade({ accountId, date, session, timezone, draft, strategies, onSaved }: {
  accountId: string; date: string; session: string; timezone: string; draft: SessionReview;
  strategies: StrategyResponse[]; onSaved: () => void
}) {
  const { t } = useI18n()
  const scope = useAccountScope()
  const [values, setValues] = useState<TradeFormValues>()
  const [error, setError] = useState('')
  const busy = useRef(false)
  const requestId = useRef('')
  const submit = async (value: TradeFormValues) => {
    if (busy.current) return
    busy.current = true
    try {
      await apiPost('/today/log-trade', { requestId: requestId.current, accountId: value.accountRefId || accountId, date, session,
        preparationRevision: value.accountRefId === accountId ? draft.readyContext?.revision ?? null : null, trade: buildTradePayload(value, timezone) })
      announceAnalyticsDataChanged(); setValues(undefined); onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : t('dailyReview.saveError')) }
    finally { busy.current = false }
  }
  return <>
    <Button variant="contained" onClick={() => {
      requestId.current = crypto.randomUUID(); setError('')
      const chart = draft.preparation?.chartSymbol
      const symbol = chart === 'OANDA:DE30EUR' ? 'GER40' : chart === 'OANDA:NAS100USD' ? 'NAS100' : chart === 'CME_MINI:ES1!' ? 'ES' : draft.instruments.split(/[,\s]+/)[0] || ''
      setValues({ symbol, market: chart?.startsWith('OANDA:') ? 'CFD' : chart === 'CME_MINI:ES1!' ? 'FUTURES' : 'OTHER', direction: 'LONG', status: 'OPEN', openedAt: formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm"), quantity: 1, entryPrice: '', accountRefId: accountId, strategyId: draft.strategyId || undefined, session: session === 'US' ? 'NY' : session === 'EUROPE' ? 'LONDON' : 'CUSTOM' })
    }}>{t('dailyReview.log')}</Button>
    <Dialog open={Boolean(values)} onClose={() => { if (!busy.current) setValues(undefined) }} fullWidth maxWidth="md"><DialogTitle>{t('dailyReview.log')}</DialogTitle><DialogContent>
      {values && <TradeForm initialValues={values} onSubmit={submit} submitLabel={t('dailyReview.log')} timezone={timezone} accounts={scope.accounts} error={error} strategyOptions={strategies.map(s => ({ id: s.id, label: s.name }))} onCancel={() => { if (!busy.current) setValues(undefined) }} />}
    </DialogContent></Dialog>
  </>
}
