import '@testing-library/jest-dom/vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayCandlestickChart from './ReplayCandlestickChart'
import { I18nProvider } from '../../i18n'

let measuredWidth = 680
let measuredHeight = 420
let resizeObservers: Array<(entries: ResizeObserverEntry[], observer: ResizeObserver) => void> = []

class ResizeObserverMock {
  private callback: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

  constructor(callback: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void) {
    this.callback = callback
    resizeObservers.push(callback)
  }

  observe(target: Element) {
    this.callback([
      {
        target,
        contentRect: {
          width: measuredWidth,
          height: measuredHeight
        } as DOMRectReadOnly
      } as ResizeObserverEntry
    ], this as unknown as ResizeObserver)
  }

  unobserve() {}

  disconnect() {}
}

const triggerResize = () => {
  for (const callback of resizeObservers) {
    callback([] as ResizeObserverEntry[], {} as ResizeObserver)
  }
}

const candles = [
  { timestamp: '2026-01-11T09:00:00Z', open: 1.1, high: 1.102, low: 1.099, close: 1.101, volume: 100 },
  { timestamp: '2026-01-11T09:05:00Z', open: 1.101, high: 1.103, low: 1.1, close: 1.102, volume: 110 },
  { timestamp: '2026-01-11T09:10:00Z', open: 1.102, high: 1.104, low: 1.101, close: 1.103, volume: 120 },
  { timestamp: '2026-01-11T09:15:00Z', open: 1.103, high: 1.105, low: 1.102, close: 1.1025, volume: 130 }
]

describe('ReplayCandlestickChart', () => {
  beforeAll(() => {
    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: measuredWidth,
      height: measuredHeight,
      top: 0,
      left: 0,
      right: measuredWidth,
      bottom: measuredHeight,
      x: 0,
      y: 0,
      toJSON: () => ''
    }))
  })

  beforeEach(() => {
    measuredWidth = 680
    measuredHeight = 420
    resizeObservers = []
  })

  it('renders candles after transitioning from empty to loaded data', async () => {
    const { rerender } = render(
      <ReplayCandlestickChart candles={[]} cursorIndex={0} minHeight={300} loading={false} />,
      { wrapper: I18nProvider }
    )

    expect(screen.getByText('No replay data')).toBeInTheDocument()

    rerender(
      <ReplayCandlestickChart candles={candles} cursorIndex={2} minHeight={300} loading={false} />
    )

    const svg = await screen.findByTestId('backtest-replay-chart-svg')
    await waitFor(() => expect(svg).toHaveAttribute('width', '680'))
    expect(screen.getAllByTestId('replay-candle')).toHaveLength(4)
    expect(screen.getByTestId('replay-cursor-line')).toBeInTheDocument()
  })

  it('resizes the chart when container dimensions change', async () => {
    render(
      <ReplayCandlestickChart candles={candles} cursorIndex={3} minHeight={300} loading={false} />,
      { wrapper: I18nProvider }
    )

    const svg = await screen.findByTestId('backtest-replay-chart-svg')
    await waitFor(() => expect(svg).toHaveAttribute('width', '680'))

    measuredWidth = 360
    measuredHeight = 220
    act(() => {
      triggerResize()
    })

    await waitFor(() => {
      expect(svg).toHaveAttribute('width', '360')
      expect(svg).toHaveAttribute('height', '300')
    })
  })

  it('keeps chart height positive on mobile-sized viewport', async () => {
    measuredWidth = 390
    measuredHeight = 180

    render(
      <ReplayCandlestickChart candles={candles} cursorIndex={1} minHeight={220} loading={false} />,
      { wrapper: I18nProvider }
    )

    const container = screen.getByTestId('backtest-replay-chart-container')
    expect(container).toBeInTheDocument()

    const svg = await screen.findByTestId('backtest-replay-chart-svg')
    await waitFor(() => {
      expect(Number(svg.getAttribute('width'))).toBeGreaterThan(0)
      expect(Number(svg.getAttribute('height'))).toBeGreaterThanOrEqual(220)
    })
  })
})
