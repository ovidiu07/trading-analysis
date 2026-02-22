import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { BacktestCandle } from '../../api/backtest'

type ReplayCandlestickChartProps = {
  candles: BacktestCandle[]
  cursorIndex: number
  minHeight?: number
  height?: number | string
  loading?: boolean
}

type HoverState = {
  x: number
  y: number
  candleIndex: number
} | null

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export default function ReplayCandlestickChart({
  candles,
  cursorIndex,
  minHeight = 300,
  height,
  loading = false
}: ReplayCandlestickChartProps) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: minHeight })
  const [hover, setHover] = useState<HoverState>(null)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const measuredWidth = rect.width || element.clientWidth
      const measuredHeight = rect.height || element.clientHeight
      setSize({
        width: Math.max(1, Math.floor(measuredWidth)),
        height: Math.max(minHeight, Math.floor(measuredHeight || minHeight))
      })
    }
    const frame = window.requestAnimationFrame(measure)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure())
      observer.observe(element)
    }
    window.addEventListener('resize', measure)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [candles.length, height, minHeight])

  const width = size.width

  const visibleCandles = useMemo(
    () => candles,
    [candles]
  )

  const chartHeight = Math.max(minHeight, size.height || minHeight)
  const hasRenderableChart = visibleCandles.length > 0 && width > 1 && chartHeight > 1

  const paddingTop = 12
  const paddingBottom = 18
  const candleAreaHeight = chartHeight - paddingTop - paddingBottom
  const step = hasRenderableChart ? width / Math.max(visibleCandles.length, 1) : 0
  const bodyWidth = hasRenderableChart ? Math.max(2, Math.min(step * 0.62, 12)) : 0

  const highs = hasRenderableChart ? visibleCandles.map((candle) => candle.high) : []
  const lows = hasRenderableChart ? visibleCandles.map((candle) => candle.low) : []
  const maxHigh = highs.length ? Math.max(...highs) : 0
  const minLow = lows.length ? Math.min(...lows) : 0
  const range = Math.max(maxHigh - minLow, Number.EPSILON)
  const yForPrice = (price: number) => {
    const ratio = (price - minLow) / range
    return paddingTop + (1 - ratio) * candleAreaHeight
  }

  const hoverCandle = hasRenderableChart && hover
    ? visibleCandles[clamp(hover.candleIndex, 0, visibleCandles.length - 1)]
    : null

  return (
    <Box
      ref={containerRef}
      data-testid="backtest-replay-chart-container"
      sx={{
        width: '100%',
        minWidth: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        minHeight,
        height: height || minHeight
      }}
    >
      {hasRenderableChart ? (
        <svg
          width={width}
          height={chartHeight}
          role="img"
          aria-label="Replay candlestick chart"
          data-testid="backtest-replay-chart-svg"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            const candleIndex = clamp(Math.floor(x / Math.max(step, 1)), 0, visibleCandles.length - 1)
            setHover({ x, y, candleIndex })
          }}
        >
          <rect x={0} y={0} width={width} height={chartHeight} fill={theme.palette.background.paper} />

          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={paddingTop + candleAreaHeight * ratio}
              y2={paddingTop + candleAreaHeight * ratio}
              stroke={theme.palette.divider}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          ))}

          {visibleCandles.map((candle, index) => {
            const centerX = index * step + step / 2
            const openY = yForPrice(candle.open)
            const closeY = yForPrice(candle.close)
            const highY = yForPrice(candle.high)
            const lowY = yForPrice(candle.low)
            const bullish = candle.close >= candle.open
            const bodyTop = Math.min(openY, closeY)
            const bodyHeight = Math.max(1, Math.abs(openY - closeY))
            const color = bullish ? theme.palette.success.main : theme.palette.error.main

            return (
              <g key={`${candle.timestamp}-${index}`} data-testid="replay-candle">
                <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth={1.2} />
                <rect
                  x={centerX - bodyWidth / 2}
                  y={bodyTop}
                  width={bodyWidth}
                  height={bodyHeight}
                  fill={bullish ? color : 'transparent'}
                  stroke={color}
                  strokeWidth={1.1}
                />
              </g>
            )
          })}

          <line
            data-testid="replay-cursor-line"
            x1={clamp(cursorIndex, 0, visibleCandles.length - 1) * step + step / 2}
            x2={clamp(cursorIndex, 0, visibleCandles.length - 1) * step + step / 2}
            y1={paddingTop}
            y2={chartHeight - paddingBottom}
            stroke={theme.palette.info.main}
            strokeDasharray="4 4"
            strokeWidth={1.2}
            opacity={0.85}
          />

          {hover && hoverCandle && (
            <>
              <line x1={hover.x} x2={hover.x} y1={paddingTop} y2={chartHeight - paddingBottom} stroke={theme.palette.text.secondary} strokeOpacity={0.5} />
              <line x1={0} x2={width} y1={hover.y} y2={hover.y} stroke={theme.palette.text.secondary} strokeOpacity={0.35} />
            </>
          )}
        </svg>
      ) : (
        <Box
          sx={{
            minHeight,
            height: height || minHeight,
            display: 'grid',
            placeItems: 'center',
            px: 1.5
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {loading ? 'Loading replay data...' : (visibleCandles.length ? 'Preparing chart container...' : 'No replay data')}
          </Typography>
        </Box>
      )}

      {hasRenderableChart && hover && hoverCandle && (
        <Box sx={{ px: 1.25, py: 0.8, borderTop: '1px solid', borderColor: 'divider', fontSize: 12 }}>
          <Typography variant="caption" sx={{ display: 'inline-block', mr: 1.25 }}>
            {new Date(hoverCandle.timestamp).toLocaleString()}
          </Typography>
          <Typography variant="caption" sx={{ display: 'inline-block', mr: 1 }}>{`O ${hoverCandle.open}`}</Typography>
          <Typography variant="caption" sx={{ display: 'inline-block', mr: 1 }}>{`H ${hoverCandle.high}`}</Typography>
          <Typography variant="caption" sx={{ display: 'inline-block', mr: 1 }}>{`L ${hoverCandle.low}`}</Typography>
          <Typography variant="caption" sx={{ display: 'inline-block' }}>{`C ${hoverCandle.close}`}</Typography>
        </Box>
      )}
    </Box>
  )
}
