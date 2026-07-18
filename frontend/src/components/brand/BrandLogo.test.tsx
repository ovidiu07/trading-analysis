import '@testing-library/jest-dom/vitest'
import { ThemeProvider, createTheme } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BrandLogo from './BrandLogo'

const renderLogo = (mode: 'light' | 'dark', layout: 'horizontal' | 'mark' = 'horizontal') => render(
  <ThemeProvider theme={createTheme({ palette: { mode } })}>
    <BrandLogo layout={layout} label="TradeJAudit home" />
  </ThemeProvider>
)

describe('BrandLogo', () => {
  it.each(['light', 'dark'] as const)('renders a transparent adaptive horizontal logo in %s mode', (mode) => {
    const { container } = renderLogo(mode)
    const logo = screen.getByRole('img', { name: 'TradeJAudit home' })

    expect(logo).toHaveAttribute('data-layout', 'horizontal')
    expect(logo).toHaveAttribute('data-variant', mode)
    expect(logo).toHaveAttribute('viewBox', '0 0 260 56')
    expect(container.querySelector('rect')).not.toBeInTheDocument()
    expect(logo).not.toHaveStyle({ backgroundColor: '#fff' })
  })

  it('renders a square symbol-only mark without stretching', () => {
    renderLogo('light', 'mark')
    const logo = screen.getByRole('img', { name: 'TradeJAudit home' })

    expect(logo).toHaveAttribute('data-layout', 'mark')
    expect(logo).toHaveAttribute('viewBox', '0 0 60 56')
    expect(Number(logo.getAttribute('width'))).toBeGreaterThan(0)
    expect(Number(logo.getAttribute('height'))).toBeGreaterThan(0)
    expect(logo).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet')
  })

  it('can be decorative when its parent link supplies the accessible name', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <BrandLogo decorative />
      </ThemeProvider>
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('brand-logo')).toHaveAttribute('aria-hidden', 'true')
  })
})
