import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { I18nProvider } from '../i18n'
import { ThemeModeProvider } from '../themeMode'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 'user-1',
      email: 'trader@example.com',
      role: 'USER',
      timezone: 'Europe/Bucharest',
      baseCurrency: 'USD',
      themePreference: 'SYSTEM'
    },
    logout: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('../components/layout/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell" />
}))

vi.mock('../components/demo/DemoDataBanner', () => ({
  default: () => null
}))

vi.mock('../components/dashboard/DefinitionsDrawer', () => ({
  default: () => null
}))

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const minMatch = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/)
    const maxMatch = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/)
    const min = minMatch ? Number(minMatch[1]) : null
    const max = maxMatch ? Number(maxMatch[1]) : null
    const matches = (min === null || width >= min) && (max === null || width <= max)
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  }) as unknown as typeof window.matchMedia
}

const renderShell = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <ThemeModeProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route path="dashboard" element={<div>Dashboard content</div>} />
              <Route path="analytics" element={<div>Analytics content</div>} />
              <Route path="diagnostics" element={<div>Diagnostics content</div>} />
              <Route path="trades" element={<div>Trades content</div>} />
              <Route path="today" element={<div>Today content</div>} />
            </Route>
          </Routes>
        </ThemeModeProvider>
      </I18nProvider>
    </MemoryRouter>
  )
}

const hasBlockingOverlay = (target: HTMLElement) => {
  const overlays = Array.from(document.body.querySelectorAll<HTMLElement>('.MuiModal-root, .MuiBackdrop-root'))
  return overlays.find((node) => {
    if (node === target || node.contains(target)) return false
    const styles = window.getComputedStyle(node)
    return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.pointerEvents !== 'none'
  }) || null
}

describe('AppShell dashboard filters and logo placement', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    localStorage.setItem('app.themePreference', 'dark')
    localStorage.setItem('layout.sidebarCollapsed', 'false')
  })

  it('keeps dashboard Filters button clickable with no click-blocking overlay and opens filters drawer', async () => {
    setViewportWidth(599)
    renderShell('/dashboard?from=2026-01-17&to=2026-02-15&status=CLOSED')

    const filtersButton = await screen.findByLabelText('Filters')
    const blocker = hasBlockingOverlay(filtersButton)
    const rect = filtersButton.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const topAtCenter = blocker || filtersButton

    expect(filtersButton).toBeEnabled()
    expect(() => fireEvent.click(filtersButton)).not.toThrow()
    expect({ centerX, centerY, topAtCenter }).toEqual(
      expect.objectContaining({
        topAtCenter: filtersButton
      })
    )

    const user = userEvent.setup()
    await user.click(filtersButton)
    const closeButton = await screen.findByLabelText('Close filters')
    expect(closeButton).toBeInTheDocument()

    await user.click(closeButton)
    expect(hasBlockingOverlay(filtersButton)).toBeNull()

    await user.click(filtersButton)
    expect(await screen.findByLabelText('Close filters')).toBeInTheDocument()
  })

  it.each(['/dashboard', '/analytics', '/trades', '/today'])(
    'removes TradeJAudit logo from top header while keeping it in the sidebar on %s',
    (route) => {
      setViewportWidth(1280)
      renderShell(route)

      const sidebar = screen.getByRole('navigation')
      expect(within(sidebar).getByAltText('TradeJAudit')).toHaveAttribute(
        'src',
        expect.stringContaining('tradejaudit-navbar.png')
      )

      const banner = screen.getByRole('banner')
      expect(within(banner).queryByAltText('TradeJAudit')).not.toBeInTheDocument()
      expect(screen.getAllByAltText('TradeJAudit')).toHaveLength(1)
    }
  )

  it('uses the supplied emblem when the desktop sidebar is collapsed', async () => {
    setViewportWidth(1280)
    renderShell('/today')

    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Collapse sidebar'))

    expect(within(screen.getByRole('navigation')).getByAltText('TradeJAudit')).toHaveAttribute(
      'src',
      expect.stringContaining('tradejaudit-mark.png')
    )
  })

  it('keeps a single page heading and exposes the branded mobile drawer at 320px', async () => {
    setViewportWidth(320)
    renderShell('/analytics')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Analytics')

    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Open menu'))
    expect(within(screen.getByRole('navigation')).getByAltText('TradeJAudit')).toHaveAttribute(
      'src',
      expect.stringContaining('tradejaudit-navbar.png')
    )
  })

  it('orders trading nav with dashboard directly under today and diagnostics before calendar', () => {
    setViewportWidth(1280)
    renderShell('/today')

    const nav = screen.getByRole('navigation')
    const expectedOrder = ['Today', 'Dashboard', 'Strategies', 'Backtesting', 'Mentor', 'Analytics', 'Diagnostics', 'Calendar']
    const nodes = expectedOrder.map((label) => within(nav).getByText(label))

    for (let index = 0; index < nodes.length - 1; index += 1) {
      const first = nodes[index]
      const second = nodes[index + 1]
      const relation = first.compareDocumentPosition(second)
      expect(Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    }
  })
})
