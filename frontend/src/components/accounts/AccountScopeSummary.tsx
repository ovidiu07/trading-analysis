import { Alert, Chip, Stack } from '@mui/material'
import type { AccountScopeValue } from '../../features/accountScope/accountScope'
import type { TradingAccountOption } from '../../api/accounts'
import { useI18n } from '../../i18n'

type Props = {
  scope: AccountScopeValue
  accounts: TradingAccountOption[]
  notice?: string
  mixedCurrency?: boolean
}

export default function AccountScopeSummary({ scope, accounts, notice, mixedCurrency = false }: Props) {
  const { t } = useI18n()
  const selected = scope.mode === 'selected'
    ? accounts.filter((account) => scope.accountIds.includes(account.id))
    : []
  const label = scope.mode === 'all'
    ? t('accountScope.all')
    : selected.length === 1
      ? selected[0].name
      : t('accountScope.manySelected', { count: scope.accountIds.length })

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Chip size="small" variant="outlined" label={`${t('accountScope.active')}: ${label}`} />
      {notice ? <Alert severity="info">{t(notice)}</Alert> : null}
      {mixedCurrency ? <Alert severity="warning">{t('accountScope.mixedCurrency')}</Alert> : null}
    </Stack>
  )
}
