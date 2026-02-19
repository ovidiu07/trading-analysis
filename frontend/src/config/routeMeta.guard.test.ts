import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTE_META_DEFINITIONS } from './routeMeta'

type GuardEntry = {
  file: string
  forbidden: string[]
}

const guardEntries: GuardEntry[] = [
  { file: 'src/pages/TradesPage.tsx', forbidden: ["t('trades.title')", '<PageHeader'] },
  { file: 'src/pages/CalendarPage.tsx', forbidden: ["t('calendar.title')", '<PageHeader'] },
  { file: 'src/pages/NotebookPage.tsx', forbidden: ["t('notebook.title')", '<PageHeader'] },
  { file: 'src/pages/AnalyticsPage.tsx', forbidden: ["t('analytics.title')", '<PageHeader'] },
  { file: 'src/pages/InsightsPage.tsx', forbidden: ["t('insights.title')", '<PageHeader'] },
  { file: 'src/pages/SettingsPage.tsx', forbidden: ["t('settings.title')", '<PageHeader'] },
  { file: 'src/pages/ProfilePage.tsx', forbidden: ["t('profile.title')", '<PageHeader'] },
  { file: 'src/pages/admin/AdminContentPage.tsx', forbidden: ["t('adminContent.title')", '<PageHeader'] },
  { file: 'src/pages/admin/AdminContentTypesPage.tsx', forbidden: ["t('adminTypes.title')", '<PageHeader'] },
  { file: 'src/pages/TermsPage.tsx', forbidden: ["t('legal.terms.title')"] },
  { file: 'src/pages/PrivacyPage.tsx', forbidden: ["t('legal.privacy.title')"] },
  { file: 'src/pages/CookiesPage.tsx', forbidden: ["t('legal.cookies.title')"] }
]

describe('Route title metadata guard', () => {
  it('keeps primary route titles in centralized route metadata', () => {
    const routeIds = ROUTE_META_DEFINITIONS.map((item) => item.id)
    expect(routeIds).toEqual(expect.arrayContaining([
      'today',
      'todaySession',
      'dashboard',
      'trades',
      'calendar',
      'notebook',
      'analytics',
      'insights',
      'settings',
      'profile',
      'adminContent',
      'adminContentTypes',
      'terms',
      'privacy',
      'cookies'
    ]))
  })

  it('prevents duplicate page-level route title rendering on primary pages', () => {
    for (const entry of guardEntries) {
      const source = readFileSync(path.resolve(process.cwd(), entry.file), 'utf8')
      for (const forbiddenToken of entry.forbidden) {
        expect(source).not.toContain(forbiddenToken)
      }
    }
  })
})
