import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField
} from '@mui/material'
import {
  announceTradingAccountsChanged,
  createTradingAccount,
  updateTradingAccount,
  type TradingAccountOption
} from '../../api/accounts'
import { useI18n } from '../../i18n'

type Props = {
  open: boolean
  account?: TradingAccountOption | null
  suggestedCurrency?: string
  onClose: () => void
  onSaved: (account: TradingAccountOption) => void
}

type Draft = {
  name: string
  broker: string
  currency: string
  accountType: string
  externalAccountId: string
  brokerServer: string
  brokerTimezone: string
  startingBalance: string
}

const toDraft = (account: TradingAccountOption | null | undefined, suggestedCurrency: string): Draft => ({
  name: account?.name || '',
  broker: account?.broker || '',
  currency: (account?.currency || suggestedCurrency || 'USD').toUpperCase(),
  accountType: account?.accountType || '',
  externalAccountId: account?.externalAccountId || '',
  brokerServer: account?.brokerServer || '',
  brokerTimezone: account?.brokerTimezone || '',
  startingBalance: account?.startingBalance == null ? '' : String(account.startingBalance)
})

export default function TradingAccountDialog({
  open,
  account,
  suggestedCurrency = 'USD',
  onClose,
  onSaved
}: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Draft>(() => toDraft(account, suggestedCurrency))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(toDraft(account, suggestedCurrency))
    setError('')
  }, [account, open, suggestedCurrency])

  const setField = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const valid = Boolean(draft.name.trim() && /^[A-Za-z]{3}$/.test(draft.currency.trim()))

  const save = async () => {
    if (!valid) return
    setSaving(true)
    setError('')
    const payload = {
      name: draft.name.trim(),
      broker: draft.broker.trim() || undefined,
      currency: draft.currency.trim().toUpperCase(),
      accountType: draft.accountType || undefined,
      externalAccountId: draft.externalAccountId.trim() || undefined,
      brokerServer: draft.brokerServer.trim() || undefined,
      brokerTimezone: draft.brokerTimezone.trim() || undefined,
      startingBalance: draft.startingBalance.trim() === '' ? null : Number(draft.startingBalance)
    }
    try {
      const saved = account
        ? await updateTradingAccount(account.id, payload)
        : await createTradingAccount(payload)
      announceTradingAccountsChanged()
      onSaved(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('tradingAccounts.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="trading-account-dialog-title"
    >
      <DialogTitle id="trading-account-dialog-title">
        {account ? t('tradingAccounts.editTitle') : t('tradingAccounts.createTitle')}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {error && <Grid item xs={12}><Alert severity="error">{error}</Alert></Grid>}
          <Grid item xs={12} md={6}>
            <TextField
              autoFocus
              required
              fullWidth
              label={t('tradingAccounts.fields.name')}
              value={draft.name}
              onChange={(event) => setField('name', event.target.value)}
              inputProps={{ maxLength: 120 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label={t('tradingAccounts.fields.currency')}
              value={draft.currency}
              onChange={(event) => setField('currency', event.target.value.toUpperCase())}
              inputProps={{ maxLength: 3 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('tradingAccounts.fields.broker')}
              value={draft.broker}
              onChange={(event) => setField('broker', event.target.value)}
              inputProps={{ maxLength: 120 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label={t('tradingAccounts.fields.accountType')}
              value={draft.accountType}
              onChange={(event) => setField('accountType', event.target.value)}
            >
              <MenuItem value="">{t('common.na')}</MenuItem>
              {['LIVE', 'DEMO', 'FUNDED', 'PERSONAL'].map((value) => (
                <MenuItem key={value} value={value}>{t(`tradingAccounts.types.${value}`)}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('tradingAccounts.fields.externalAccountId')}
              value={draft.externalAccountId}
              onChange={(event) => setField('externalAccountId', event.target.value)}
              inputProps={{ maxLength: 128 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('tradingAccounts.fields.server')}
              value={draft.brokerServer}
              onChange={(event) => setField('brokerServer', event.target.value)}
              inputProps={{ maxLength: 160 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('tradingAccounts.fields.timezone')}
              value={draft.brokerTimezone}
              onChange={(event) => setField('brokerTimezone', event.target.value)}
              placeholder="Europe/London"
              inputProps={{ maxLength: 80 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label={t('tradingAccounts.fields.startingBalance')}
              value={draft.startingBalance}
              onChange={(event) => setField('startingBalance', event.target.value)}
              inputProps={{ step: '0.01' }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button type="button" variant="contained" onClick={() => void save()} disabled={!valid || saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
