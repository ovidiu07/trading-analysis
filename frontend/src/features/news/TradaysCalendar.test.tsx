import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TradaysCalendar, { TradaysWarning, useContextClock } from './TradaysCalendar'
import { unavailableTradays } from './tradaysWarnings'
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'ro-RO' }) }))
afterEach(() => { cleanup(); vi.useRealTimers() })
describe('Tradays integration boundaries', () => {
  it('preserves attribution and only uses builder-supported settings', () => {
    render(<TradaysCalendar live timezone="Europe/Bucharest" />)
    const code = screen.getByTitle('news.tradays.title').getAttribute('srcdoc')!
    expect(code).toContain('"mode":"1"'); expect(code).toContain('"lang":"en"')
    expect(code).toContain('MQL5 Algo Trading Community'); expect(code).toContain('widget.js?v=15')
    expect(code).not.toContain('timezone'); expect(code).not.toContain('importance')
    expect(screen.getByText('news.tradays.limits')).toBeInTheDocument()
  })
  it('hides live embeds for historical and saved views', () => {
    render(<TradaysCalendar live={false} timezone="Europe/Bucharest" />)
    expect(screen.queryByTitle('news.tradays.title')).toBeNull()
    expect(screen.getByText('news.tradays.history')).toBeInTheDocument()
  })
  it('keeps a fallback because an iframe load event cannot confirm provider success', () => {
    render(<TradaysCalendar live timezone="Europe/Bucharest" />)
    fireEvent.load(screen.getByTitle('news.tradays.title'))
    expect(screen.getByText('news.tradays.unverified')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'news.tradays.open' })).toBeInTheDocument()
  })
  it('updates the injected clock on timer, focus and background resume and cleans up', () => {
    vi.useFakeTimers()
    let value = 100
    const clock = () => value
    const hook = renderHook(() => useContextClock(clock))
    value = 200; act(() => vi.advanceTimersByTime(1000)); expect(hook.result.current).toBe(200)
    value = 300; act(() => globalThis.dispatchEvent(new Event('focus'))); expect(hook.result.current).toBe(300)
    value = 400; act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(hook.result.current).toBe(400)
    hook.unmount(); expect(vi.getTimerCount()).toBe(0)
  })
  it('renders unavailable coverage independently of tabs and suppresses frozen warnings', () => {
    const props = { data: unavailableTradays, now: Date.parse('2026-10-01T12:00Z'), date: '2026-10-01', timezone: 'Europe/Bucharest' }
    const view = render(<TradaysWarning {...props} frozen={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('news.tradays.warning.UNAVAILABLE')
    view.rerender(<TradaysWarning {...props} frozen />); expect(screen.queryByRole('status')).toBeNull()
  })
})
