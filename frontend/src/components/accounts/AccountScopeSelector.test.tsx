import '@testing-library/jest-dom/vitest'
import { ThemeProvider, createTheme } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { allAccountsScope } from '../../features/accountScope/accountScope'
import AccountScopeSelector from './AccountScopeSelector'
import AccountScopeSummary from './AccountScopeSummary'

const accounts = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Primary',
    broker: 'IC Markets',
    currency: 'USD',
    externalAccountId: '12345678'
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Swing',
    broker: 'Pepperstone',
    currency: 'EUR',
    externalAccountId: '87654321'
  }
]

const renderSelector = (props: Partial<React.ComponentProps<typeof AccountScopeSelector>> = {}) => {
  const onChange = vi.fn()
  render(
    <ThemeProvider theme={createTheme()}>
      <I18nProvider>
        <AccountScopeSelector
          value={allAccountsScope()}
          onChange={onChange}
          accounts={accounts}
          {...props}
        />
      </I18nProvider>
    </ThemeProvider>
  )
  return onChange
}

describe('AccountScopeSelector', () => {
  it('shows searchable account metadata and emits internal IDs', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector()

    await user.click(screen.getByRole('combobox', { name: 'Account' }))
    expect(screen.getByText('IC Markets · USD · ••••5678')).toBeInTheDocument()

    await user.click(screen.getByText('Primary'))
    expect(onChange).toHaveBeenCalledWith({
      mode: 'selected',
      accountIds: [accounts[0].id]
    })
  })

  it('exposes loading, failure, and retry states accessibly', () => {
    const retry = vi.fn()
    renderSelector({ error: true, loading: true, onRetry: retry })

    expect(screen.getByText('Accounts could not be loaded. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading accounts' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows a dedicated empty state when the user has no accounts', () => {
    renderSelector({ accounts: [] })

    expect(screen.getByText('No TradeJAudit accounts were found.')).toBeInTheDocument()
  })

  it('states the active scope and blocks false mixed-currency totals', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <I18nProvider>
          <AccountScopeSummary
            scope={{ mode: 'selected', accountIds: accounts.map((account) => account.id) }}
            accounts={accounts}
            mixedCurrency
          />
        </I18nProvider>
      </ThemeProvider>
    )

    expect(screen.getByText('Account scope: 2 accounts selected')).toBeInTheDocument()
    expect(screen.getByText(/Combined monetary analytics are unavailable/)).toBeInTheDocument()
  })

  it('renders missing account currency separately from mixed currencies', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <I18nProvider>
          <AccountScopeSummary
            scope={{ mode: 'selected', accountIds: [accounts[0].id] }}
            accounts={accounts}
            unavailableReason="MISSING_ACCOUNT_CURRENCY"
            resolvedAccountIds={[accounts[0].id]}
            selectedAccountCount={1}
          />
        </I18nProvider>
      </ThemeProvider>
    )

    expect(screen.getByText('Account scope: Primary')).toBeInTheDocument()
    expect(screen.getByText(/does not have a base currency configured/)).toBeInTheDocument()
    expect(screen.queryByText(/different base currencies/)).not.toBeInTheDocument()
  })

  it('does not show a warning for one resolved account with authoritative NONE metadata', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <I18nProvider>
          <AccountScopeSummary
            scope={{ mode: 'selected', accountIds: [accounts[0].id] }}
            accounts={accounts}
            unavailableReason="NONE"
            resolvedAccountIds={[accounts[0].id]}
            selectedAccountCount={1}
          />
        </I18nProvider>
      </ThemeProvider>
    )

    expect(screen.getByText('Account scope: Primary')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
