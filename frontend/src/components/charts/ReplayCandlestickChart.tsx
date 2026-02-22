import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { BacktestCandle } from '../../api/backtest'

type ReplayCandlestickChartProps = {
  candles: BacktestCandle[]
  cursorIndex: number
  minHeight?: number
}

type HoverState = {
  x: number
  y: number
  candleIndex: number
} | null

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export default function ReplayCandlestickChart({ candles, cursorIndex, minHeight = 300 }: ReplayCandlestickChartProps) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<HoverState>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      setWidth(Math.max(1, Math.floor(element.clientWidth)))
    }
    measure()

    const observer = new ResizeObserver(() => measure())
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  const visibleCandles = useMemo(
    () => candles.slice(0, clamp(cursorIndex + 1, 0, candles.length)),
    [candles, cursorIndex]
  )

  if (!visibleCandles.length) {
    return (
      <Box sx={{ minHeight, display: 'grid', placeItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">No replay data</Typography>
      </Box>
    )
  }

  const highs = visibleCandles.map((candle) => candle.high)
  const lows = visibleCandles.map((candle) => candle.low)
  const maxHigh = Math.max(...highs)
  const minLow = Math.min(...lows)
  const range = Math.max(maxHigh - minLow, Number.EPSILON)
  const chartHeight = minHeight
  const paddingTop = 12
  const paddingBottom = 18
  const candleAreaHeight = chartHeight - paddingTop - paddingBottom
  const step = width / Math.max(visibleCandles.length, 1)
  const bodyWidth = Math.max(2, Math.min(step * 0.62, 12))

  const yForPrice = (price: number) => {
    const ratio = (price - minLow) / range
    return paddingTop + (1 - ratio) * candleAreaHeight
  }

  const hoverCandle = hover ? visibleCandles[clamp(hover.candleIndex, 0, visibleCandles.length - 1)] : null

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        minWidth: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'background.paper'
      }}
    >
      <svg
        width={width}
        height={chartHeight}
        role="img"
        aria-label="Replay candlestick chart"
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
            <g key={`${candle.timestamp}-${index}`}>
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

      {hover && hoverCandle && (
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
