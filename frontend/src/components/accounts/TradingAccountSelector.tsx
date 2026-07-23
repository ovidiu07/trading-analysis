import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import type { TradingAccountOption } from '../../api/accounts'
import { useI18n } from '../../i18n'
import TradingAccountDialog from './TradingAccountDialog'

export type TradingAccountSelectorProps = {
  value: string | null
  onChange: (accountId: string | null) => void
  accounts: TradingAccountOption[]
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onAccountsChanged?: (savedAccount?: TradingAccountOption) => void | Promise<unknown>
  allowCreate?: boolean
  allowEdit?: boolean
  allowClear?: boolean
  disabled?: boolean
  required?: boolean
  context?: 'trade-create' | 'trade-edit' | 'quick-log' | 'import' | 'note'
  suggestedCurrency?: string
  size?: 'small' | 'medium'
}

const metadata = (account: TradingAccountOption, archivedLabel: string) => [
  account.broker,
  account.currency,
  account.accountType,
  account.status === 'ARCHIVED' ? archivedLabel : null
].filter(Boolean).join(' · ')

export default function TradingAccountSelector({
  value,
  onChange,
  accounts,
  loading = false,
  error = false,
  onRetry,
  onAccountsChanged,
  allowCreate = true,
  allowEdit = true,
  allowClear = false,
  disabled = false,
  required = false,
  context = 'trade-create',
  suggestedCurrency = 'USD',
  size = 'medium'
}: TradingAccountSelectorProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [ephemeral, setEphemeral] = useState<TradingAccountOption | null>(null)
  const mutationContext = context !== 'note'

  const allAccounts = useMemo(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]))
    if (ephemeral) byId.set(ephemeral.id, ephemeral)
    return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name))
  }, [accounts, ephemeral])

  const selected = allAccounts.find((account) => account.id === value) || null
  const options = mutationContext
    ? allAccounts.filter((account) => account.status !== 'DISABLED' && (
        account.status !== 'ARCHIVED' || account.id === value
      ))
    : allAccounts.filter((account) => account.status !== 'DISABLED')

  const closeDialog = () => {
    setDialogMode(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSaved = (saved: TradingAccountOption) => {
    setEphemeral(saved)
    onChange(saved.id)
    setDialogMode(null)
    void onAccountsChanged?.(saved)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const empty = !loading && !error && options.length === 0

  return (
    <Stack spacing={0.75}>
      <Autocomplete
        options={options}
        value={selected}
        loading={loading}
        disabled={disabled}
        fullWidth
        autoHighlight
        clearOnEscape={allowClear}
        disableClearable={!allowClear}
        isOptionEqualToValue={(option, current) => option.id === current.id}
        getOptionLabel={(option) => option.name}
        getOptionDisabled={(option) => option.status === 'ARCHIVED'}
        noOptionsText={empty ? t('tradingAccounts.empty') : t('tradingAccounts.noResults')}
        loadingText={t('tradingAccounts.loading')}
        onChange={(_, next) => onChange(next?.id || null)}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id}>
            <Stack spacing={0.2} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>{option.name}</Typography>
              {metadata(option, t('tradingAccounts.status.ARCHIVED')) && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {metadata(option, t('tradingAccounts.status.ARCHIVED'))}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            required={required}
            size={size}
            label={t('tradingAccounts.selectorLabel')}
            placeholder={t('tradingAccounts.placeholder')}
            error={error}
            helperText={loading
              ? t('tradingAccounts.loading')
              : error
                ? t('tradingAccounts.errors.load')
                : empty
                  ? t('tradingAccounts.emptyHelp')
                  : selected
                    ? metadata(selected, t('tradingAccounts.status.ARCHIVED'))
                    : undefined}
            inputRef={inputRef}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={18} /> : null}
                  {error && onRetry ? (
                    <IconButton
                      type="button"
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRetry()
                      }}
                      aria-label={t('common.retry')}
                    >
                      <ReplayRoundedIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
      />

      {selected?.status === 'ARCHIVED' && (
        <Alert severity="warning">{t('tradingAccounts.archivedSelection')}</Alert>
      )}

      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {allowCreate && (
          <Button type="button" size="small" startIcon={<AddRoundedIcon />} onClick={() => setDialogMode('create')}>
            {t('tradingAccounts.actions.create')}
          </Button>
        )}
        {allowEdit && (
          <Button
            type="button"
            size="small"
            startIcon={<EditRoundedIcon />}
            disabled={!selected}
            onClick={() => setDialogMode('edit')}
          >
            {t('tradingAccounts.actions.edit')}
          </Button>
        )}
        <Button
          type="button"
          size="small"
          startIcon={<ManageAccountsRoundedIcon />}
          component="a"
          href="/settings#trading-accounts"
        >
          {t('tradingAccounts.actions.manage')}
        </Button>
      </Stack>

      <TradingAccountDialog
        open={dialogMode !== null}
        account={dialogMode === 'edit' ? selected : null}
        suggestedCurrency={selected?.currency || suggestedCurrency}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
    </Stack>
  )
}
