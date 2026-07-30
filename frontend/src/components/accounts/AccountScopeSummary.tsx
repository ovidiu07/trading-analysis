import { Alert, Chip, Stack } from '@mui/material'
import type { AccountScopeValue } from '../../features/accountScope/accountScope'
import type { TradingAccountOption } from '../../api/accounts'
import { useI18n } from '../../i18n'

type Props = {
  scope: AccountScopeValue
  accounts: TradingAccountOption[]
  notice?: string
  unavailableReason?: 'NONE' | 'MULTIPLE_ACCOUNT_CURRENCIES' | 'MISSING_ACCOUNT_CURRENCY' | 'NO_ACCOUNTS_SELECTED' | 'INVALID_ACCOUNT_SELECTION'
  resolvedAccountIds?: string[]
  selectedAccountCount?: number
  mixedCurrency?: boolean
}

export default function AccountScopeSummary({
  scope,
  accounts,
  notice,
  unavailableReason = 'NONE',
  resolvedAccountIds,
  selectedAccountCount,
  mixedCurrency = false
}: Props) {
  const { t } = useI18n()
  const effectiveIds = resolvedAccountIds || (scope.mode === 'selected' ? scope.accountIds : [])
  const selected = scope.mode === 'selected'
    ? accounts.filter((account) => effectiveIds.includes(account.id))
    : []
  const effectiveCount = selectedAccountCount ?? effectiveIds.length
  const label = scope.mode === 'all'
    ? t('accountScope.all')
    : effectiveCount === 1 && selected.length === 1
      ? selected[0].name
      : effectiveCount === 1
        ? t('accountScope.oneSelected')
        : t('accountScope.manySelected', { count: effectiveCount })
  const warningKey = unavailableReason === 'MULTIPLE_ACCOUNT_CURRENCIES' || mixedCurrency
    ? 'accountScope.mixedCurrency'
    : unavailableReason === 'MISSING_ACCOUNT_CURRENCY'
      ? 'accountScope.missingCurrency'
      : unavailableReason === 'NO_ACCOUNTS_SELECTED'
        ? 'accountScope.noAccountsSelected'
        : unavailableReason === 'INVALID_ACCOUNT_SELECTION'
          ? 'accountScope.invalidSelection'
          : ''

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Chip size="small" variant="outlined" label={`${t('accountScope.active')}: ${label}`} />
      {notice ? <Alert severity="info">{t(notice)}</Alert> : null}
      {warningKey ? <Alert severity="warning">{t(warningKey)}</Alert> : null}
    </Stack>
  )
}
