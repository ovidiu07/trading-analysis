import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded'
import { fetchTradingAccounts, type TradingAccountOption } from '../../api/accounts'
import {
  deleteAccountTrades,
  previewTradeDeletion,
  type TradeDeletionPreview,
  type TradeDeletionResult,
  type TradeDeletionScope
} from '../../api/tradeData'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n'
import { formatCurrency, formatDateTime } from '../../utils/format'

type Props = {
  timezone: string
}

export default function TradeDataManagementCard({ timezone }: Props) {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<TradingAccountOption[]>([])
  const [accountId, setAccountId] = useState('')
  const [scope, setScope] = useState<TradeDeletionScope>('DATE_RANGE')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [preview, setPreview] = useState<TradeDeletionPreview | null>(null)
  const [result, setResult] = useState<TradeDeletionResult | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accountId, accounts]
  )

  const loadAccounts = useCallback(async () => {
    try {
      const loaded = await fetchTradingAccounts()
      setAccounts(loaded)
      setAccountId((current) => current && loaded.some((account) => account.id === current)
        ? current
        : loaded.length === 1 ? loaded[0].id : '')
    } catch {
      setError(t('settings.tradeData.errors.accounts'))
    }
  }, [t])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    setPreview(null)
    setResult(null)
    setConfirmationText('')
  }, [accountId, scope, startDate, endDate])

  const request = () => ({
    accountId,
    scope,
    startDate: scope === 'DATE_RANGE' ? startDate : undefined,
    endDate: scope === 'DATE_RANGE' ? endDate : undefined,
    timezone
  })

  const handlePreview = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setPreview(await previewTradeDeletion(request()))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('settings.tradeData.errors.preview'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!preview) return
    setDeleting(true)
    setError('')
    try {
      const deleted = await deleteAccountTrades({
        ...request(),
        confirmed: true,
        confirmationText,
        previewToken: preview.previewToken
      })
      setResult(deleted)
      setPreview(null)
      setConfirmationText('')
      await loadAccounts()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('settings.tradeData.errors.delete'))
    } finally {
      setDeleting(false)
    }
  }

  const datesValid = scope === 'ENTIRE_HISTORY'
    || Boolean(startDate && endDate && endDate >= startDate)
  const strongConfirmationValid = scope === 'DATE_RANGE'
    || confirmationText === selectedAccount?.name
  const currency = selectedAccount?.currency || 'EUR'

  return (
    <Card>
      <CardContent>
        <Stack spacing={2} maxWidth={760}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DeleteForeverRoundedIcon color="error" />
            <Typography variant="h6">{t('settings.tradeData.title')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('settings.tradeData.subtitle')}
          </Typography>
          <Alert severity="warning">{t('settings.tradeData.warning')}</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity="success">
              {t('settings.tradeData.deleted', {
                count: result.deletedTrades,
                pnl: formatCurrency(result.deletedRealizedPnl, currency)
              })}
            </Alert>
          )}

          <TextField
            select
            required
            fullWidth
            label={t('settings.tradeData.account')}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {[account.name, account.broker, account.currency].filter(Boolean).join(' — ')}
              </MenuItem>
            ))}
          </TextField>

          <RadioGroup
            value={scope}
            onChange={(event) => setScope(event.target.value as TradeDeletionScope)}
          >
            <FormControlLabel value="DATE_RANGE" control={<Radio />} label={t('settings.tradeData.range')} />
            <FormControlLabel value="ENTIRE_HISTORY" control={<Radio />} label={t('settings.tradeData.entire')} />
          </RadioGroup>

          {scope === 'DATE_RANGE' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="date"
                label={t('settings.tradeData.startDate')}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                type="date"
                label={t('settings.tradeData.endDate')}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}

          <Typography variant="caption" color="text.secondary">
            {t('settings.tradeData.timezone', { timezone })}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handlePreview()}
            disabled={loading || !accountId || !datesValid}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            {loading ? t('common.loading') : t('settings.tradeData.preview')}
          </Button>
        </Stack>
      </CardContent>

      <Dialog open={Boolean(preview)} onClose={() => !deleting && setPreview(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('settings.tradeData.confirmTitle')}</DialogTitle>
        {preview && (
          <>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Alert severity="error">{t('settings.tradeData.confirmWarning')}</Alert>
                <Typography>{t('settings.tradeData.account')}: {preview.accountName}</Typography>
                <Typography>{t('settings.tradeData.affected')}: {preview.tradeCount}</Typography>
                <Typography>{t('settings.tradeData.realizedPnl')}: {formatCurrency(preview.realizedPnl, currency)}</Typography>
                <Typography>{t('settings.tradeData.linkedNotes')}: {preview.linkedJournalRecords}</Typography>
                {preview.earliestAffectedTrade && (
                  <Typography>{t('settings.tradeData.earliest')}: {formatDateTime(preview.earliestAffectedTrade, preview.timezone)}</Typography>
                )}
                {preview.latestAffectedTrade && (
                  <Typography>{t('settings.tradeData.latest')}: {formatDateTime(preview.latestAffectedTrade, preview.timezone)}</Typography>
                )}
                <Divider />
                <Typography variant="subtitle2">{t('settings.tradeData.sources')}</Typography>
                {Object.entries(preview.sourceDistribution).map(([source, count]) => (
                  <Typography key={source} variant="body2">{source}: {count}</Typography>
                ))}
                {scope === 'ENTIRE_HISTORY' && (
                  <TextField
                    autoFocus
                    fullWidth
                    label={t('settings.tradeData.typeAccountName')}
                    helperText={t('settings.tradeData.typeAccountNameHelp', { account: preview.accountName })}
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreview(null)} disabled={deleting}>{t('common.cancel')}</Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => void handleDelete()}
                disabled={deleting || preview.tradeCount === 0 || !strongConfirmationValid}
              >
                {deleting ? t('settings.tradeData.deleting') : t('settings.tradeData.deletePermanently')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  )
}
