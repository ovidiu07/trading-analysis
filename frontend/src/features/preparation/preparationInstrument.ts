import type { SetupItem } from '../../api/liveWorkspace'

export function resolvePreparationInstrument(chartSymbol: string, instruments: string): { symbol: string; market: NonNullable<SetupItem['market']> } {
  const selected = (chartSymbol || instruments.split(',')[0] || '').trim().toUpperCase()
  if (selected.includes('CME_MINI:ES') || /^ES(?:[FGHJKMNQUVXZ]\d{1,4})?$/.test(selected)) return { symbol: selected.includes(':') ? 'ES' : selected, market: 'FUTURES' }
  if (selected.includes('DE30') || selected.includes('DAX') || selected.includes('GER40')) return { symbol: 'DAX', market: 'CFD' }
  if (selected.includes('NAS100') || selected.includes('NASDAQ-100')) return { symbol: 'NAS100', market: 'CFD' }
  const plain = selected.split(':').pop()?.replace(/[^A-Z0-9]/g, '') || ''
  if (/^[A-Z]{6}$/.test(plain)) return { symbol: plain, market: 'FOREX' }
  return { symbol: plain || 'UNSET', market: 'OTHER' }
}
