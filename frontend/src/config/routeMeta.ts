type TranslationParams = Record<string, string | number>

type TranslationFn = (key: string, params?: TranslationParams) => string
type RouteMatcher = (pathname: string) => boolean

export type RouteMetaContext = {
  timezone: string
}

type RouteMetaDefinition = {
  id: string
  match: RouteMatcher
  pageTitleKey: string
  pageSubtitleKey?: string
  subtitleParams?: (context: RouteMetaContext) => TranslationParams
  showHeader?: boolean
}

export type ResolvedRouteMeta = {
  id: string
  pageTitle: string
  pageSubtitle: string
  showHeader: boolean
}

const matchesExact = (path: string): RouteMatcher => (pathname) => pathname === path
const matchesPrefix = (path: string): RouteMatcher => (pathname) => pathname === path || pathname.startsWith(`${path}/`)

export const ROUTE_META_DEFINITIONS: RouteMetaDefinition[] = [
  {
    id: 'dashboard',
    match: matchesPrefix('/dashboard'),
    pageTitleKey: 'dashboard.title',
    pageSubtitleKey: 'dashboard.subtitle'
  },
  {
    id: 'trades',
    match: matchesPrefix('/trades'),
    pageTitleKey: 'trades.title',
    pageSubtitleKey: 'trades.subtitle'
  },
  {
    id: 'calendar',
    match: matchesPrefix('/calendar'),
    pageTitleKey: 'calendar.title',
    pageSubtitleKey: 'calendar.subtitle',
    subtitleParams: ({ timezone }) => ({ timezone })
  },
  {
    id: 'notebook',
    match: matchesPrefix('/notebook'),
    pageTitleKey: 'notebook.title',
    pageSubtitleKey: 'notebook.subtitle'
  },
  {
    id: 'analytics',
    match: matchesPrefix('/analytics'),
    pageTitleKey: 'analytics.title',
    pageSubtitleKey: 'analytics.subtitle'
  },
  {
    id: 'insights',
    match: matchesExact('/insights'),
    pageTitleKey: 'insights.title',
    pageSubtitleKey: 'insights.subtitle',
    showHeader: false
  },
  {
    id: 'insightDetail',
    match: (pathname) => pathname.startsWith('/insights/'),
    pageTitleKey: 'insights.title',
    showHeader: false
  },
  {
    id: 'settings',
    match: matchesPrefix('/settings'),
    pageTitleKey: 'settings.title',
    pageSubtitleKey: 'settings.subtitle'
  },
  {
    id: 'profile',
    match: matchesPrefix('/profile'),
    pageTitleKey: 'profile.title',
    pageSubtitleKey: 'profile.subtitle'
  },
  {
    id: 'adminContent',
    match: matchesExact('/admin/content'),
    pageTitleKey: 'adminContent.title',
    pageSubtitleKey: 'adminContent.subtitle'
  },
  {
    id: 'adminContentTypes',
    match: matchesExact('/admin/content/types'),
    pageTitleKey: 'adminTypes.title',
    pageSubtitleKey: 'adminTypes.subtitle'
  },
  {
    id: 'adminEditor',
    match: (pathname) => pathname.startsWith('/admin/content/'),
    pageTitleKey: 'adminContent.title',
    showHeader: false
  },
  {
    id: 'terms',
    match: matchesExact('/terms'),
    pageTitleKey: 'legal.terms.title',
    pageSubtitleKey: 'legal.disclaimer'
  },
  {
    id: 'privacy',
    match: matchesExact('/privacy'),
    pageTitleKey: 'legal.privacy.title',
    pageSubtitleKey: 'legal.disclaimer'
  },
  {
    id: 'cookies',
    match: matchesExact('/cookies'),
    pageTitleKey: 'legal.cookies.title',
    pageSubtitleKey: 'legal.disclaimer'
  }
]

export const resolveRouteMeta = (
  pathname: string,
  t: TranslationFn,
  context: RouteMetaContext
): ResolvedRouteMeta | null => {
  const match = ROUTE_META_DEFINITIONS.find((item) => item.match(pathname))
  if (!match) return null

  const subtitleParams = match.subtitleParams?.(context)
  return {
    id: match.id,
    pageTitle: t(match.pageTitleKey),
    pageSubtitle: match.pageSubtitleKey ? t(match.pageSubtitleKey, subtitleParams) : '',
    showHeader: match.showHeader !== false
  }
}
