import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n'
import type { BacktestingWorkspace } from '../../api/backtesting'
import { WorkspaceDialog } from './BacktestingDialogs'

function RomanianSwitch() {
  const { setLanguage } = useI18n()
  return <button onClick={() => setLanguage('ro')}>Switch to Romanian</button>
}

describe('workspace optional instrument', () => {
  beforeEach(() => localStorage.setItem('app.language', 'en'))

  it('creates a named workspace without an instrument', async () => {
    const onSave = vi.fn()
    render(<I18nProvider><WorkspaceDialog open workspace={null} strategies={[]} saving={false} onClose={vi.fn()} onSave={onSave} /></I18nProvider>)
    const instrument = screen.getByRole('textbox', { name: 'Instrument (optional)' })
    expect(instrument).not.toBeRequired()
    fireEvent.change(screen.getByRole('textbox', { name: /Workspace name/ }), { target: { value: 'Five sessions' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Five sessions', symbol: null }))
  })

  it('lets an existing workspace clear its instrument', async () => {
    const onSave = vi.fn()
    render(<I18nProvider><WorkspaceDialog open workspace={{ id: 'w', title: 'Five sessions', symbol: 'GER40F' } as BacktestingWorkspace} strategies={[]} saving={false} onClose={vi.fn()} onSave={onSave} /></I18nProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Instrument (optional)' }), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ symbol: null }))
  })

  it('explains the optional instrument in Romanian', async () => {
    render(<I18nProvider><RomanianSwitch /><WorkspaceDialog open workspace={null} strategies={[]} saving={false} onClose={vi.fn()} onSave={vi.fn()} /></I18nProvider>)
    fireEvent.click(screen.getByText('Switch to Romanian'))
    expect(screen.getByRole('textbox', { name: 'Instrument (opțional)' })).not.toBeRequired()
    expect(screen.getByText('Lasă necompletat pentru a cerceta orice instrument. Tranzacțiile importate păstrează instrumentul din CSV.')).toBeInTheDocument()
  })
})
