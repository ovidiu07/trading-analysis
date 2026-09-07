import { Preparation } from '../../api/sessionReviews'
export function selectBriefing(now: Date, _previous: 'ASIA' | 'LONDON' | 'DAY_RECAP' = 'ASIA', manual?: 'ASIA' | 'LONDON' | 'DAY_RECAP') {
  if (manual) return manual
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number)
  const minutes = parts[0] * 60 + parts[1]
  return minutes < 975 ? 'ASIA' : minutes < 1350 ? 'LONDON' : 'DAY_RECAP'
}
export function initialPreparation(briefingDate?: string): Preparation {
  return { briefingDate, step: 0, briefingSession: selectBriefing(new Date()), manualSession: false, bias: 'neutral', chartPlan: '', chartSymbol: 'OANDA:DE30EUR', chartInterval: '15', observing: false, contextAcknowledged: false, chartConfirmed: false, preparationConfirmed: false, checklist: [] }
}
// Text-only presentation: never inject user-authored HTML into the live DOM.
export function strategyText(value?: string | null) {
  const document = new DOMParser().parseFromString(value || '', 'text/html')
  document.querySelectorAll('script,style,iframe,object').forEach(node => node.remove())
  document.querySelectorAll('p,li,br,h3,h4').forEach(node => node.append('\n'))
  return (document.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}
