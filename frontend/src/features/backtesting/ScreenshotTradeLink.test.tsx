import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { detachBacktestingScreenshotTrade, updateBacktestingScreenshot, type BacktestingScreenshot, type BacktestingTrade } from '../../api/backtesting'
import ScreenshotTradeLink from './ScreenshotTradeLink'

vi.mock('../../api/backtesting', () => ({ detachBacktestingScreenshotTrade: vi.fn(), updateBacktestingScreenshot: vi.fn() }))
const screenshot = { id: 's', workspaceId: 'w', caption: 'Original caption', session: 'London', timeframe: '1m', tags: ['atEntry', 'FVG'], sortOrder: 2 } as BacktestingScreenshot
const trades = [{ id: 't', workspaceId: 'w', date: '2026-10-29', entryTime: '10:15', instrument: 'DAX', direction: 'LONG', source: 'IMPORT', tradeScope: 'REPLAY' },
  { id: 'secret', workspaceId: 'another', source: 'IMPORT' }, { id: 'live', workspaceId: 'w', source: 'LIVE' }] as BacktestingTrade[]
beforeEach(() => { vi.resetAllMocks(); localStorage.setItem('app.language', 'en') })
const click = (element: HTMLElement) => act(async () => { await userEvent.click(element) })

it('links only a trade from the same workspace and preserves caption, tags and context', async () => {
  const saved = vi.fn(async () => {})
  render(<I18nProvider><ScreenshotTradeLink screenshot={screenshot} trades={trades} onSaved={saved} onError={vi.fn()} /></I18nProvider>)
  await click(screen.getByRole('combobox'))
  expect(screen.getAllByRole('option')).toHaveLength(2)
  await click(screen.getByRole('option', { name: /2026-10-29/ }))
  expect(updateBacktestingScreenshot).toHaveBeenCalledWith('s', expect.objectContaining({ backtestingTradeId: 't', caption: 'Original caption', tags: ['atEntry', 'FVG'], session: 'London', timeframe: '1m', sortOrder: 2 }))
  expect(saved).toHaveBeenCalledOnce()
})

it('uses the explicit detach endpoint to restore workspace context', async () => {
  render(<I18nProvider><ScreenshotTradeLink screenshot={{ ...screenshot, backtestingTradeId: 't' }} trades={trades} onSaved={vi.fn(async () => {})} onError={vi.fn()} /></I18nProvider>)
  await click(screen.getByRole('combobox'))
  const options = screen.getAllByRole('option')
  await click(options[0])
  expect(detachBacktestingScreenshotTrade).toHaveBeenCalledWith('s')
  expect(updateBacktestingScreenshot).not.toHaveBeenCalled()
})
