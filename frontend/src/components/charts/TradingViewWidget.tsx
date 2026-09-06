import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Link, Typography, useTheme } from '@mui/material'

type TradingViewWidgetProps = {
  symbol?: string | null
  interval?: string | null
  themePreference?: 'LIGHT' | 'DARK' | 'SYSTEM' | string | null
  hideControls?: boolean | null
  allowSymbolChange?: boolean | null
  preloadedIndicators?: string[] | null
  height?: string | number
  minHeight?: number
  fallbackMessage?: string
  fallbackLinkLabel?: string
}

const DEFAULT_INTERVAL = '15'
const TRADINGVIEW_WIDGET_SCRIPT = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'

const normalizeInterval = (value?: string | null) => {
  const trimmed = value?.trim().toUpperCase() || DEFAULT_INTERVAL
  if (!trimmed) return DEFAULT_INTERVAL
  return trimmed
}

const resolveTheme = (
  preference: TradingViewWidgetProps['themePreference'],
  mode: 'light' | 'dark'
): 'light' | 'dark' => {
  if (preference === 'LIGHT') return 'light'
  if (preference === 'DARK') return 'dark'
  return mode
}

export default function TradingViewWidget({
  symbol,
  interval,
  themePreference,
  hideControls,
  allowSymbolChange,
  preloadedIndicators,
  minHeight = 420,
  height,
  fallbackMessage = 'Live TradingView chart could not be embedded in this browser context.',
  fallbackLinkLabel = 'Open on TradingView'
}: TradingViewWidgetProps) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const normalizedSymbol = (symbol || '').trim()
  const widgetTheme = resolveTheme(themePreference, theme.palette.mode === 'dark' ? 'dark' : 'light')
  const normalizedInterval = normalizeInterval(interval)
  const normalizedStudies = useMemo(() => {
    const seen = new Set<string>()
    return (preloadedIndicators || [])
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        if (seen.has(item)) return false
        seen.add(item)
        return true
      })
  }, [preloadedIndicators])
  const studiesSignature = normalizedStudies.join('|')
  const widgetKey = `${normalizedSymbol}-${normalizedInterval}-${widgetTheme}-${hideControls !== true ? 'full' : 'compact'}-${allowSymbolChange ? 'symbol' : 'locked'}-${studiesSignature}`

  useEffect(() => {
    setLoading(true)
    setFailed(false)
  }, [widgetKey])

  useEffect(() => {
    const target = containerRef.current
    if (!normalizedSymbol || !target) return undefined

    target.innerHTML = ''
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.title = `TradingView ${normalizedSymbol}`
    widget.style.width = '100%'
    widget.style.height = '100%'
    widget.style.minHeight = '100%'

    const script = document.createElement('script')
    script.src = TRADINGVIEW_WIDGET_SCRIPT
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: normalizedSymbol,
      interval: normalizedInterval,
      timezone: 'exchange',
      theme: widgetTheme,
      style: '1',
      locale: 'en',
      hide_side_toolbar: hideControls !== true ? false : true,
      hide_top_toolbar: hideControls !== true ? false : true,
      allow_symbol_change: Boolean(allowSymbolChange),
      withdateranges: true,
      hideideas: true,
      studies: normalizedStudies,
      support_host: 'https://www.tradingview.com'
    })
    script.onload = () => setLoading(false)
    script.onerror = () => {
      setFailed(true)
      setLoading(false)
    }
    target.appendChild(widget)
    target.appendChild(script)

    return () => {
      target.innerHTML = ''
    }
  }, [allowSymbolChange, hideControls, normalizedInterval, normalizedStudies, normalizedSymbol, widgetKey, widgetTheme])

  useEffect(() => {
    if (!normalizedSymbol || !loading) return undefined
    const timer = window.setTimeout(() => {
      setFailed(true)
      setLoading(false)
    }, 12000)
    return () => window.clearTimeout(timer)
  }, [loading, normalizedSymbol, widgetKey])

  if (!normalizedSymbol) {
    return null
  }

  const openUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalizedSymbol)}`

  return (
    <Box sx={{ width: '100%', minWidth: 0, height: height ?? minHeight, minHeight }}>
      {failed ? (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {fallbackMessage}
          </Typography>
          <Link href={openUrl} target="_blank" rel="noopener noreferrer">{fallbackLinkLabel}</Link>
        </Alert>
      ) : (
        <Box
          ref={containerRef}
          className="tradingview-widget-container"
          data-testid="tradingview-widget-target"
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            '& .tradingview-widget-container__widget': {
              width: '100%',
              height: '100%'
            },
            '& iframe': {
              width: '100% !important',
              height: '100% !important'
            }
          }}
        >
          {/* TradingView autosize reads parent dimensions, so every ancestor in this chain needs a real height. */}
        </Box>
      )}
    </Box>
  )
}
