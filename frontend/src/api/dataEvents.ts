export const analyticsDataChangedEvent = 'tradejaudit:analytics-data-changed'

export function announceAnalyticsDataChanged() {
  window.dispatchEvent(new CustomEvent(analyticsDataChangedEvent))
}
