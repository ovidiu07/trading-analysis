import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import {
  announceTradingAccountsChanged,
  archiveTradingAccount,
  fetchTradingAccounts,
  restoreTradingAccount,
  setDefaultTradingAccount,
  type TradingAccountOption
} from '../../api/accounts'
import { useI18n } from '../../i18n'
import TradingAccountDialog from './TradingAccountDialog'

export default function TradingAccountsManager() {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<TradingAccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState<TradingAccountOption | 'create' | null>(null)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAccounts(await fetchTradingAccounts())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('tradingAccounts.errors.load'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const mutate = async (
    account: TradingAccountOption,
    action: (id: string) => Promise<TradingAccountOption>,
    successKey: string
  ) => {
    setBusyId(account.id)
    setError('')
    setMessage('')
    try {
      await action(account.id)
      announceTradingAccountsChanged()
      await load()
      setMessage(t(successKey))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('tradingAccounts.errors.save'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <Card id="trading-accounts" sx={{ scrollMarginTop: 96 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6">{t('tradingAccounts.manager.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('tradingAccounts.manager.subtitle')}
              </Typography>
            </Box>
            <Button
              type="button"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setEditor('create')}
            >
              {t('tradingAccounts.actions.create')}
            </Button>
          </Stack>

          {message && <Alert severity="success">{message}</Alert>}
          {error && (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={() => void load()}>{t('common.retry')}</Button>}
            >
              {error}
            </Alert>
          )}

          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">{t('tradingAccounts.loading')}</Typography>
            </Stack>
          ) : accounts.length === 0 ? (
            <Alert severity="info">{t('tradingAccounts.emptyHelp')}</Alert>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.5}>
              {accounts.map((account) => (
                <Stack
                  key={account.id}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems={{ md: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                      <Typography fontWeight={700}>{account.name}</Typography>
                      {account.isDefault && <Chip size="small" color="primary" label={t('tradingAccounts.default')} />}
                      <Chip
                        size="small"
                        variant="outlined"
                        color={account.status === 'ARCHIVED' ? 'default' : 'success'}
                        label={t(`tradingAccounts.status.${account.status || 'ACTIVE'}`)}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {[account.broker, account.currency, account.accountType].filter(Boolean).join(' · ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('tradingAccounts.manager.linkedTrades', { count: account.tradeCount || 0 })}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    <Button
                      type="button"
                      size="small"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => setEditor(account)}
                    >
                      {t('common.edit')}
                    </Button>
                    {account.status === 'ARCHIVED' ? (
                      <Button
                        type="button"
                        size="small"
                        startIcon={<RestoreRoundedIcon />}
                        disabled={busyId === account.id}
                        onClick={() => void mutate(account, restoreTradingAccount, 'tradingAccounts.messages.restored')}
                      >
                        {t('tradingAccounts.actions.restore')}
                      </Button>
                    ) : (
                      <>
                        {!account.isDefault && (
                          <Button
                            type="button"
                            size="small"
                            startIcon={<StarRoundedIcon />}
                            disabled={busyId === account.id}
                            onClick={() => void mutate(account, setDefaultTradingAccount, 'tradingAccounts.messages.defaultSet')}
                          >
                            {t('tradingAccounts.actions.setDefault')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="small"
                          color="warning"
                          startIcon={<ArchiveRoundedIcon />}
                          disabled={busyId === account.id}
                          onClick={() => void mutate(account, archiveTradingAccount, 'tradingAccounts.messages.archived')}
                        >
                          {t('tradingAccounts.actions.archive')}
                        </Button>
                      </>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>

      <TradingAccountDialog
        open={editor !== null}
        account={editor && editor !== 'create' ? editor : null}
        onClose={() => setEditor(null)}
        onSaved={(saved) => {
          setEditor(null)
          setAccounts((current) => {
            const byId = new Map(current.map((account) => [account.id, account]))
            byId.set(saved.id, saved)
            return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name))
          })
          setMessage(t('tradingAccounts.messages.saved'))
          void load()
        }}
      />
    </Card>
  )
}
