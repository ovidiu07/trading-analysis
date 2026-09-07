import { useMemo, useState, useEffect } from 'react'
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
const SCRIPT = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'

export default function TradingViewWidget({symbol, interval, themePreference, hideControls,
  allowSymbolChange, preloadedIndicators, height, minHeight=420,
  fallbackMessage='TradingView chart could not be embedded in this browser context.',
  fallbackLinkLabel='Open on TradingView'}:TradingViewWidgetProps) {
  const theme=useTheme()
  const normalizedSymbol=(symbol || '').trim()
  const normalizedInterval=(interval || '15').trim().toUpperCase()
  const widgetTheme=themePreference==='LIGHT'?'light':themePreference==='DARK'?'dark':theme.palette.mode
  const studiesSignature=JSON.stringify([...new Set((preloadedIndicators || []).map(s=>s.trim()).filter(Boolean))])
  const openUrl=`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalizedSymbol)}`
  // Keep the official embed in its own browsing context. React StrictMode/step teardown
  // can otherwise remove currentScript.parentElement while TradingView is still loading.
  // No data is read from this document or its nested TradingView iframe.
  const srcDoc=useMemo(()=>{
    const config=JSON.stringify({autosize:true,symbol:normalizedSymbol,interval:normalizedInterval,
      timezone:'exchange',theme:widgetTheme,style:'1',locale:'en',
      hide_side_toolbar:hideControls===true,hide_top_toolbar:hideControls===true,
      allow_symbol_change:Boolean(allowSymbolChange),withdateranges:true,hideideas:true,
      studies:JSON.parse(studiesSignature),support_host:'https://www.tradingview.com'}).replace(/</g,'\\u003c')
    return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}.tradingview-widget-container{width:100%;height:100%}.tradingview-widget-container__widget{height:calc(100% - 24px);width:100%}.tradingview-widget-copyright{height:24px;font:12px/24px sans-serif;text-align:center}a{color:${widgetTheme==='dark'?'#90caf9':'#1565c0'}}</style></head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="${openUrl}" rel="noopener noreferrer" target="_blank">Track all markets on TradingView</a></div><script src="${SCRIPT}" async type="text/javascript">${config}</script></div></body></html>`
  },[normalizedSymbol,normalizedInterval,widgetTheme,hideControls,allowSymbolChange,studiesSignature,openUrl])
  const [failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[srcDoc])
  if(!normalizedSymbol)return null
  return <Box data-testid="tradingview-widget-target" sx={{width:'100%',minWidth:0,height:height??minHeight,minHeight,border:1,borderColor:'divider',borderRadius:2,overflow:'hidden',backgroundColor:'background.paper'}}>
    {failed?<Alert severity="warning"><Typography variant="body2">{fallbackMessage}</Typography><Link href={openUrl} target="_blank" rel="noopener noreferrer">{fallbackLinkLabel}</Link></Alert>:
      <iframe title={`TradingView ${normalizedSymbol}`} srcDoc={srcDoc} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" onError={()=>setFailed(true)} style={{display:'block',border:0,width:'100%',height:'100%'}} />}
  </Box>
}
