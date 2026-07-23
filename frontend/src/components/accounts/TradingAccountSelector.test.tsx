import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import TradingAccountSelector from './TradingAccountSelector'

vi.mock('../../api/accounts', async () => {
  const actual = await vi.importActual<typeof import('../../api/accounts')>('../../api/accounts')
  return {
    ...actual,
    createTradingAccount: vi.fn().mockResolvedValue({
      id: 'new-account',
      name: 'New account',
      broker: 'TRDX',
      currency: 'USD',
      status: 'ACTIVE'
    })
  }
})

describe('TradingAccountSelector', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
  })

  it('shows human-readable account metadata and opens the shared create dialog', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <TradingAccountSelector
          value="account-1"
          onChange={vi.fn()}
          accounts={[{
            id: 'account-1',
            name: 'Main account',
            broker: 'TRDX',
            currency: 'USD',
            accountType: 'FUNDED',
            status: 'ACTIVE'
          }]}
        />
      </I18nProvider>
    )

    expect(screen.getByRole('combobox', { name: 'Trading account' })).toHaveValue('Main account')
    expect(screen.getByText('TRDX · USD · FUNDED')).toBeInTheDocument()
    expect(screen.queryByText('account-1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create new account' }))
    expect(await screen.findByRole('dialog', { name: 'Create trading account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Account name/)).toBeInTheDocument()
  })
})
