import '@testing-library/jest-dom/vitest'
import { render,screen } from '@testing-library/react'
import { ThemeProvider,createTheme } from '@mui/material/styles'
import { describe,it,expect } from 'vitest'
import TradingViewWidget from './TradingViewWidget'
const theme=createTheme()
function view(symbol?:string,note=''){return <ThemeProvider theme={theme}><input aria-label="Private plan" value={note} readOnly/><TradingViewWidget symbol={symbol} interval="15" hideControls={false}/></ThemeProvider>}
describe('official TradingView embed lifecycle',()=>{
 it('omits the widget without a symbol',()=>{render(view());expect(screen.queryByTitle(/TradingView/)).not.toBeInTheDocument()})
 it('uses the official script, attribution, dimensions, and explicit toolbar settings',()=>{render(view('TVC:UKOIL'));const frame=screen.getByTitle('TradingView TVC:UKOIL');const source=frame.getAttribute('srcdoc')!;expect(source).toContain('https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');expect(source).toContain('Track all markets on TradingView');expect(source).toContain('"hide_side_toolbar":false');expect(source).toContain('"timezone":"exchange"');expect(frame).toHaveStyle({height:'100%',width:'100%'})})
 it('retains the same iframe and document when private notes change',()=>{const {rerender}=render(view('TVC:UKOIL'));const original=screen.getByTitle('TradingView TVC:UKOIL');const source=original.getAttribute('srcdoc');rerender(view('TVC:UKOIL','private text'));expect(screen.getByTitle('TradingView TVC:UKOIL')).toBe(original);expect(original.getAttribute('srcdoc')).toBe(source)})
 it('updates the isolated document only when chart configuration changes',()=>{const {rerender}=render(view('TVC:UKOIL'));const source=screen.getByTitle('TradingView TVC:UKOIL').getAttribute('srcdoc');rerender(view('XETR:DAX'));expect(screen.getByTitle('TradingView XETR:DAX').getAttribute('srcdoc')).not.toBe(source)})
 it('prevents supplied symbol text from closing the configuration script',()=>{render(view('X</script><script>alert(1)</script>'));const source=screen.getByTitle(/TradingView/).getAttribute('srcdoc')!;expect(source).not.toContain('X</script>');expect(source).toContain('\\u003c/script>')})
})
