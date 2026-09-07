import { memo, useState } from 'react'
import { Alert, Box, Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material'
import TradingViewWidget from '../../components/charts/TradingViewWidget'
import { useI18n } from '../../i18n'
export const monitorSymbols = [
 ['TVC:UKOIL','Brent · TVC · CFD'],['TVC:USOIL','WTI · TVC · CFD'],['TVC:DXY','US Dollar Index · TVC · Index'],
 ['TVC:US02Y','US 2Y · TVC · Yield %'],['TVC:US10Y','US 10Y · TVC · Yield %'],['TVC:DE02Y','Germany 2Y · TVC · Yield %'],['TVC:DE10Y','Germany 10Y · TVC · Yield %'],
 ['XETR:DAX','DAX · XETR · Cash index'],['NASDAQ:NDX','Nasdaq-100 · NASDAQ · Cash index'],['CME_MINI:ES1!','ES · CME · Continuous futures (1!)']
] as const
// Browser-verified restrictions, 2026-09-06. Never substitute a different instrument silently.
const embeddedSymbols=new Set(['TVC:UKOIL','TVC:USOIL','XETR:DAX'])
export const MarketMonitor=memo(function MarketMonitor({historical=false}:{historical?:boolean}) {
 const {t}=useI18n();const [symbol,setSymbol]=useState<string>(monitorSymbols[0][0]);const [open,setOpen]=useState(false)
 return <Box component="details" open={open} onToggle={e=>setOpen(e.currentTarget.open)} sx={{minWidth:0,border:1,borderColor:'divider',borderRadius:1,p:1.5}}>
 <Box component="summary" sx={{cursor:'pointer',py:1,fontWeight:600}}>{t(historical?'editorial.currentMonitor':'editorial.monitor')}</Box>
 {open && <Stack spacing={1}><Alert severity="info">{t('editorial.monitorNotice')}</Alert><TextField select label={t('editorial.instrument')} value={symbol} onChange={e=>setSymbol(e.target.value)}>{monitorSymbols.map(([id,label])=><MenuItem value={id} key={id} sx={{whiteSpace:'normal'}}>{label}</MenuItem>)}</TextField>
 {embeddedSymbols.has(symbol) ? <TradingViewWidget symbol={symbol} interval="D" height={360} minHeight={360} hideControls fallbackMessage={t('editorial.embedUnavailable')} fallbackLinkLabel={t('editorial.openTradingView')}/> : <Alert severity="warning">{t('editorial.restrictedSymbol')}</Alert>}
 <Typography variant="caption">{t('editorial.embedUnavailable')}</Typography><Link target="_blank" rel="noopener noreferrer" href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`}>{t('editorial.openTradingView')} · TradingView</Link>
 <Typography variant="caption">{t('editorial.metricsUnavailable')}</Typography><Button onClick={()=>setOpen(false)}>{t('editorial.hideMonitor')}</Button></Stack>}
 </Box>
})
