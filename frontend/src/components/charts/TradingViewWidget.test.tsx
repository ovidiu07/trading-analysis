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

  it('initializes the TradingView advanced chart script when symbol is provided', () => {
    const { container } = renderWithTheme(
      <TradingViewWidget
        symbol="TVC:DAX"
        interval="15"
        themePreference="SYSTEM"
        hideControls={false}
        allowSymbolChange
        preloadedIndicators={['MASimple@tv-basicstudies', 'RSI@tv-basicstudies']}
      />
    )

    const target = screen.getByTitle('TradingView TVC:DAX')
    expect(target).toBeInTheDocument()
    const script = container.querySelector('script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]')
    expect(script).toBeInTheDocument()
    const config = JSON.parse(script?.innerHTML || '{}')
    expect(config).toMatchObject({
      symbol: 'TVC:DAX',
      interval: '15',
      allow_symbol_change: true,
      hide_side_toolbar: false
    })
    expect(config.studies).toEqual(['MASimple@tv-basicstudies', 'RSI@tv-basicstudies'])
  })
})
