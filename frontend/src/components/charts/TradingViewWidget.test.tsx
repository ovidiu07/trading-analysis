import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import TradingViewWidget from './TradingViewWidget'

const renderWithTheme = (node: ReactNode, mode: 'light' | 'dark' = 'light') => {
  const theme = createTheme({ palette: { mode } })
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)
}

describe('TradingViewWidget', () => {
  it('renders nothing when symbol is missing', () => {
    const { container } = renderWithTheme(<TradingViewWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a TradingView iframe when symbol is provided', () => {
    renderWithTheme(
      <TradingViewWidget
        symbol="TVC:DAX"
        interval="15"
        themePreference="SYSTEM"
        hideControls
        allowSymbolChange={false}
      />
    )

    const iframe = screen.getByTitle('TradingView TVC:DAX')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', expect.stringContaining('symbol=TVC%3ADAX'))
    expect(iframe).toHaveAttribute('src', expect.stringContaining('interval=15'))
  })
})
