import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it } from 'vitest'
import { createAppTheme } from '../../theme'
import { FinancialValue, MetricCard, SectionHeader, StatusPill } from './designSystem'

const renderWithTheme = (node: React.ReactNode) => render(
  <ThemeProvider theme={createAppTheme('dark')}>{node}</ThemeProvider>
)

describe('design system primitives', () => {
  it('renders section hierarchy and metric content', () => {
    renderWithTheme(
      <>
        <SectionHeader title="Performance" description="Selected account" />
        <MetricCard label="Net P&L" value="+$125.00" />
      </>
    )

    expect(screen.getByRole('heading', { name: 'Performance', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Net P&L')).toBeInTheDocument()
  })

  it('adds a textual status cue and formats unavailable values safely', () => {
    renderWithTheme(
      <>
        <StatusPill label="Short" tone="short" />
        <FinancialValue value={null} kind="currency" currency="USD" />
      </>
    )

    expect(screen.getByText('Short')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
