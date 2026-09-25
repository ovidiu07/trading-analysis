import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import ManualLevels, { ManualLevelList } from './ManualLevels'
import type { ManualLevel } from '../../api/sessionReviews'

afterEach(() => { cleanup(); localStorage.clear() })
const level: ManualLevel = { id: 'one', instrument: 'OANDA:DE30EUR', label: 'SUPPORT', value: 18000, unit: 'EUR', note: 'Private', updatedAt: '2026-09-25T12:00:00Z' }
it('scopes editing and deletion exactly without disturbing another instrument', () => {
  const change=vi.fn(); const other={ ...level, id:'two', instrument:'XETR:DAX', value:19000 }
  render(<I18nProvider><ManualLevels instrument="OANDA:DE30EUR" levels={[level,other]} onChange={change} timezone="Europe/Bucharest" /></I18nProvider>)
  expect(screen.getByText('18,000 EUR')).toBeInTheDocument();expect(screen.queryByText('19,000 EUR')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Edit'}));fireEvent.change(screen.getByLabelText('Price level'),{target:{value:'18001,25'}})
  fireEvent.click(screen.getByRole('button',{name:'Apply level'}));expect(change.mock.calls[0][0]).toEqual([{...level,value:18001.25,updatedAt:undefined},other])
  fireEvent.click(screen.getByRole('button',{name:'Remove'}));expect(change.mock.calls[1][0]).toEqual([other])
})
it('rejects invalid numbers and unqualified instrument names', () => {
  const change=vi.fn();const view=render(<I18nProvider><ManualLevels instrument="OANDA:DE30EUR" levels={[]} onChange={change} timezone="Europe/Bucharest" /></I18nProvider>)
  fireEvent.click(screen.getByRole('button',{name:'Add private level'}));fireEvent.change(screen.getByLabelText('Price level'),{target:{value:'-1'}})
  fireEvent.click(screen.getByRole('button',{name:'Apply level'}));expect(screen.getByRole('alert')).toBeInTheDocument();expect(change).not.toHaveBeenCalled()
  view.unmount();render(<I18nProvider><ManualLevels instrument="DAX" levels={[]} onChange={change} timezone="Europe/Bucharest" /></I18nProvider>)
  expect(screen.getByRole('button',{name:'Add private level'})).toBeDisabled()
})
it('renders historical manual snapshots without editing controls', () => {
  render(<I18nProvider><ManualLevelList levels={[level]} /></I18nProvider>)
  expect(screen.getByText(/Manual · private/)).toHaveTextContent('OANDA:DE30EUR');expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
