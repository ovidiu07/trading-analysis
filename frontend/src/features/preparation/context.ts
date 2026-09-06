import { Preparation } from '../../api/sessionReviews'
export function selectBriefing(now: Date, previous: 'ASIA' | 'LONDON' = 'ASIA', manual?: 'ASIA' | 'LONDON') {
  if (manual) return manual
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number)
  const minutes = parts[0] * 60 + parts[1]
  return minutes <= 960 ? 'ASIA' : minutes < 975 ? previous : 'LONDON'
}
export function initialPreparation(): Preparation {
  return { step: 0, briefingSession: selectBriefing(new Date()), manualSession: false, bias: 'neutral', chartPlan: '', chartSymbol: 'OANDA:DE30EUR', chartInterval: '15', observing: false, contextAcknowledged: false, chartConfirmed: false, preparationConfirmed: false, checklist: [] }
}
// Text-only presentation: never inject user-authored HTML into the live DOM.
export function strategyText(value?: string | null) {
  const document = new DOMParser().parseFromString(value || '', 'text/html')
  document.querySelectorAll('script,style,iframe,object').forEach(node => node.remove())
  document.querySelectorAll('p,li,br,h3,h4').forEach(node => node.append('\n'))
  return (document.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}
