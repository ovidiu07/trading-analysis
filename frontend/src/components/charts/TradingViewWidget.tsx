import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Link, Typography, useTheme } from '@mui/material'

type TradingViewWidgetProps = {
  symbol?: string | null
  interval?: string | null
  themePreference?: 'LIGHT' | 'DARK' | 'SYSTEM' | string | null
  hideControls?: boolean | null
  allowSymbolChange?: boolean | null
  minHeight?: number
  fallbackMessage?: string
  fallbackLinkLabel?: string
}

const DEFAULT_INTERVAL = '15'

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
  minHeight = 420,
  fallbackMessage = 'Live TradingView chart could not be embedded in this browser context.',
  fallbackLinkLabel = 'Open on TradingView'
}: TradingViewWidgetProps) {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const normalizedSymbol = (symbol || '').trim()
  const widgetTheme = resolveTheme(themePreference, theme.palette.mode === 'dark' ? 'dark' : 'light')

  const src = useMemo(() => {
    if (!normalizedSymbol) return ''
    const params = new URLSearchParams({
      symbol: normalizedSymbol,
      interval: normalizeInterval(interval),
      theme: widgetTheme,
      style: '1',
      locale: 'en',
      hide_top_toolbar: hideControls === false ? '0' : '1',
      hidesidetoolbar: hideControls === false ? '0' : '1',
      allow_symbol_change: allowSymbolChange ? '1' : '0',
      withdateranges: '1',
      hideideas: '1'
    })
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`
  }, [allowSymbolChange, hideControls, interval, normalizedSymbol, widgetTheme])

  useEffect(() => {
    setLoading(true)
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (!src || !loading) return undefined
    const timer = window.setTimeout(() => {
      setFailed(true)
      setLoading(false)
    }, 12000)
    return () => window.clearTimeout(timer)
  }, [loading, src])

  if (!normalizedSymbol) {
    return null
  }

  const openUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalizedSymbol)}`

  return (
    <Box sx={{ width: '100%' }}>
      {failed ? (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {fallbackMessage}
          </Typography>
          <Link href={openUrl} target="_blank" rel="noopener noreferrer">{fallbackLinkLabel}</Link>
        </Alert>
      ) : (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Box
            component="iframe"
            title={`TradingView ${normalizedSymbol}`}
            src={src}
            onLoad={() => setLoading(false)}
            onError={() => {
              setFailed(true)
              setLoading(false)
            }}
            sx={{
              width: '100%',
              height: '100%',
              minHeight,
              border: 0,
              display: 'block'
            }}
            loading="lazy"
            allowFullScreen
          />
        </Box>
      )}
    </Box>
  )
}
