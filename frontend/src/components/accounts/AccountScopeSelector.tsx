import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import {
  Autocomplete,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import Tooltip from '@mui/material/Tooltip'
import type { TradingAccountOption } from '../../api/accounts'
import type { AccountScopeValue } from '../../features/accountScope/accountScope'
import { allAccountsScope, selectedAccountsScope } from '../../features/accountScope/accountScope'
import { useI18n } from '../../i18n'

type AllOption = { id: '__all__'; name: string; all: true }
type SelectorOption = TradingAccountOption | AllOption

type AccountScopeSelectorProps = {
  value: AccountScopeValue
  onChange: (value: AccountScopeValue) => void
  accounts: TradingAccountOption[]
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  disabled?: boolean
  fullWidth?: boolean
  size?: 'small' | 'medium'
}

const isAllOption = (option: SelectorOption): option is AllOption => 'all' in option

const accountMetadata = (account: TradingAccountOption) => {
  const suffix = account.externalAccountId
    ? `••••${account.externalAccountId.slice(-4)}`
    : ''
  return [account.broker, account.currency, suffix].filter(Boolean).join(' · ')
}

export default function AccountScopeSelector({
  value,
  onChange,
  accounts,
  loading = false,
  error = false,
  onRetry,
  disabled = false,
  fullWidth = true,
  size = 'small'
}: AccountScopeSelectorProps) {
  const { t } = useI18n()
  const allOption: AllOption = { id: '__all__', name: t('accountScope.all'), all: true }
  const options: SelectorOption[] = [allOption, ...accounts]
  const selected = value.mode === 'all'
    ? [allOption]
    : accounts.filter((account) => value.accountIds.includes(account.id))

  const selectedLabel = value.mode === 'all'
    ? t('accountScope.all')
    : value.accountIds.length === 1
      ? t('accountScope.oneSelected')
      : t('accountScope.manySelected', { count: value.accountIds.length })
  const empty = !loading && !error && accounts.length === 0

  return (
    <Autocomplete<SelectorOption, true, false, false>
      multiple
      disableCloseOnSelect
      options={options}
      value={selected}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      isOptionEqualToValue={(option, selectedOption) => option.id === selectedOption.id}
      getOptionLabel={(option) => option.name}
      noOptionsText={accounts.length === 0 ? t('accountScope.empty') : t('accountScope.noResults')}
      loadingText={t('accountScope.loading')}
      onChange={(_, next, _reason, details) => {
        if (details?.option && isAllOption(details.option)) {
          onChange(allAccountsScope())
          return
        }
        const accountOptions = next.filter((option) => !isAllOption(option))
        if (accountOptions.length === 0) {
          onChange(allAccountsScope())
          return
        }
        onChange(selectedAccountsScope(accountOptions.map((option) => option.id)))
      }}
      renderTags={() => (
        <Typography variant="body2" noWrap sx={{ maxWidth: '100%' }}>
          {selectedLabel}
        </Typography>
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          {isAllOption(option) ? (
            <Typography variant="body2" fontWeight={600}>{option.name}</Typography>
          ) : (
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{option.name}</Typography>
              {accountMetadata(option) && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {accountMetadata(option)}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size={size}
          label={t('accountScope.label')}
          error={error}
          helperText={error ? t('accountScope.error') : empty ? t('accountScope.empty') : undefined}
          inputProps={{
            ...params.inputProps,
            'aria-label': t('accountScope.label')
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {error && onRetry ? (
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRetry()
                    }}
                    aria-label={t('accountScope.retry')}
                  >
                    <ReplayRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
                <Tooltip title={t('tradingAccounts.actions.manage')}>
                  <IconButton
                    size="small"
                    component="a"
                    href="/settings#trading-accounts"
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('tradingAccounts.actions.manage')}
                  >
                    <ManageAccountsRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {params.InputProps.endAdornment}
              </>
            )
          }}
          sx={{ minWidth: 0 }}
        />
      )}
      sx={{
        minWidth: 0,
        '& .MuiAutocomplete-inputRoot': {
          minHeight: size === 'small' ? 40 : 44,
          flexWrap: 'nowrap',
          overflow: 'hidden'
        },
        '& .MuiAutocomplete-tag': { maxWidth: 'calc(100% - 42px)' }
      }}
    />
  )
}
