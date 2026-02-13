import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ErrorBanner from '../components/ui/ErrorBanner'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import FilterBar, { FilterTypeOption } from '../components/insights/FilterBar'
import ContentCard from '../components/insights/ContentCard'
import StrategyCard from '../components/insights/StrategyCard'
import { ContentPost, ContentType, listContentTypes, listPublishedContent } from '../api/content'
import { fetchFeaturedDailyPlan, fetchFeaturedWeeklyPlan, FeaturedPlan } from '../api/today'
import { createFollow, listFollows, FollowType } from '../api/follows'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { formatDateTime } from '../utils/format'
import { trackEvent } from '../utils/analytics/ga4'

type InsightsTab = 'today' | 'week' | 'playbooks' | 'learn'

type TabConfig = {
  key: InsightsTab
  path: string
  typeKeys: string[]
}

const TAB_CONFIGS: TabConfig[] = [
  { key: 'today', path: '/insights/today', typeKeys: ['DAILY_PLAN'] },
  { key: 'week', path: '/insights/week', typeKeys: ['WEEKLY_PLAN'] },
  { key: 'playbooks', path: '/insights/playbooks', typeKeys: ['STRATEGY', 'PLAYBOOK'] },
  { key: 'learn', path: '/insights/learn', typeKeys: ['EDUCATION', 'MARKET_RECAP', 'RISK_MANAGEMENT', 'PSYCHOLOGY', 'CHECKLIST'] }
]

const parseCsv = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const normalize = (value: string) => value.trim().toLowerCase()

const resolveTabFromPath = (pathname: string): InsightsTab => {
  if (pathname === '/insights/week') return 'week'
  if (pathname === '/insights/playbooks') return 'playbooks'
  if (pathname === '/insights/learn') return 'learn'
  return 'today'
}

const typeLabelForKey = (key: string, types: ContentType[], language: string) => {
  const match = types.find((type) => type.key === key)
  if (!match) return key
  return match.translations?.[language]?.displayName || match.displayName || key
}

const sortByRecent = (a: ContentPost, b: ContentPost) => {
  const aTime = new Date(a.updatedAt || a.publishedAt || a.createdAt || '').getTime()
  const bTime = new Date(b.updatedAt || b.publishedAt || b.createdAt || '').getTime()
  return bTime - aTime
}

const fetchByTypeKeys = async (typeKeys: string[], query: string) => {
  const requests = typeKeys.map((typeKey) => listPublishedContent({ type: typeKey, q: query, activeOnly: true }))
  const responseGroups = await Promise.all(requests)

  const deduped = new Map<string, ContentPost>()
  responseGroups.flat().forEach((item) => {
    deduped.set(item.id, item)
  })

  return Array.from(deduped.values()).sort(sortByRecent)
}

export default function InsightsPage() {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const timezone = user?.timezone ?? 'Europe/Bucharest'
  const location = useLocation()
  const navigate = useNavigate()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const activeTab = useMemo(() => resolveTabFromPath(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [secondaryType, setSecondaryType] = useState('')
  const [visibleCount, setVisibleCount] = useState(8)
  const [followMessage, setFollowMessage] = useState('')
  const [followError, setFollowError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    trackEvent('insights_view', {
      success: true,
      feature_area: 'insights',
      tab: activeTab
    })
  }, [activeTab])

  useEffect(() => {
    setVisibleCount(8)
  }, [activeTab, debouncedSearch, tagFilter, symbolFilter, secondaryType])

  const contentTypesQuery = useQuery({
    queryKey: ['insightsTypes'],
    queryFn: () => listContentTypes()
  })

  const feedQuery = useQuery({
    queryKey: ['insightsFeed', activeTab, debouncedSearch],
    queryFn: async () => {
      const tabConfig = TAB_CONFIGS.find((config) => config.key === activeTab) || TAB_CONFIGS[0]
      return fetchByTypeKeys(tabConfig.typeKeys, debouncedSearch)
    }
  })

  const featuredDailyQuery = useQuery({
    queryKey: ['featuredDailyPlan', timezone],
    queryFn: (): Promise<FeaturedPlan | null> => fetchFeaturedDailyPlan(timezone),
    enabled: activeTab === 'today' && Boolean(timezone)
  })

  const featuredWeeklyQuery = useQuery({
    queryKey: ['featuredWeeklyPlan', timezone],
    queryFn: (): Promise<FeaturedPlan | null> => fetchFeaturedWeeklyPlan(timezone),
    enabled: activeTab === 'week' && Boolean(timezone)
  })

  const followsQuery = useQuery({
    queryKey: ['follows'],
    queryFn: () => listFollows()
  })

  const types = contentTypesQuery.data || []

  const localizedFeedItems = useMemo(() => {
    const items = feedQuery.data || []
    return items.map((item) => {
      const translation = item.translations?.[language]
      return {
        ...item,
        title: translation?.title || item.title,
        summary: translation?.summary ?? item.summary,
        body: translation?.body || item.body,
        contentTypeDisplayName: typeLabelForKey(item.contentTypeKey, types, language)
      }
    })
  }, [feedQuery.data, language, types])

  const secondaryOptions = useMemo<FilterTypeOption[]>(() => {
    const tabConfig = TAB_CONFIGS.find((config) => config.key === activeTab) || TAB_CONFIGS[0]
    const optionKeys = new Set(tabConfig.typeKeys)

    return types
      .filter((type) => optionKeys.has(type.key))
      .map((type) => ({
        key: type.key,
        label: type.translations?.[language]?.displayName || type.displayName || type.key
      }))
  }, [activeTab, language, types])

  const filteredItems = useMemo(() => {
    const tagTokens = parseCsv(tagFilter).map(normalize)
    const symbolTokens = parseCsv(symbolFilter).map(normalize)

    return localizedFeedItems.filter((item) => {
      if (secondaryType && item.contentTypeKey !== secondaryType) {
        return false
      }
      const tags = (item.tags || []).map(normalize)
      const symbols = (item.symbols || []).map(normalize)
      const tagMatch = tagTokens.length === 0 || tagTokens.every((token) => tags.includes(token))
      const symbolMatch = symbolTokens.length === 0 || symbolTokens.every((token) => symbols.includes(token))
      return tagMatch && symbolMatch
    })
  }, [localizedFeedItems, secondaryType, symbolFilter, tagFilter])

  const featuredFromFeed = filteredItems[0]

  const featuredCard = useMemo(() => {
    if (activeTab === 'today') {
      const featured = featuredDailyQuery.data
      if (!featured) return null
      return {
        title: featured.title,
        summary: featured.biasSummary,
        ctaPath: `/insights/${featured.slug || featured.id}`,
        ctaLabel: t('today.actions.openPlan'),
        updatedAt: featured.updatedAt || featured.publishedAt || null
      }
    }

    if (activeTab === 'week') {
      const featured = featuredWeeklyQuery.data
      if (!featured) return null
      return {
        title: featured.title,
        summary: featured.biasSummary,
        ctaPath: `/insights/${featured.slug || featured.id}`,
        ctaLabel: t('today.actions.openWeeklyPlan'),
        updatedAt: featured.updatedAt || featured.publishedAt || null
      }
    }

    if (!featuredFromFeed) {
      return null
    }

    return {
      title: featuredFromFeed.title,
      summary: featuredFromFeed.summary || '',
      ctaPath: `/insights/${featuredFromFeed.slug || featuredFromFeed.id}`,
      ctaLabel: t('insights.actions.open'),
      updatedAt: featuredFromFeed.updatedAt || featuredFromFeed.publishedAt || null
    }
  }, [activeTab, featuredDailyQuery.data, featuredFromFeed, featuredWeeklyQuery.data, t])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const canLoadMore = visibleCount < filteredItems.length

  const followedSet = useMemo(() => {
    const follows = followsQuery.data || []
    return new Set(follows.map((follow) => `${follow.followType}:${follow.value}`))
  }, [followsQuery.data])

  const resolveFollowTarget = (item: ContentPost): { followType: FollowType; value: string } | null => {
    if (item.contentTypeKey === 'STRATEGY' || item.contentTypeKey === 'PLAYBOOK') {
      return { followType: 'STRATEGY', value: item.id }
    }
    const symbol = (item.symbols || []).map((value) => value.trim()).find(Boolean)
    if (symbol) {
      return { followType: 'SYMBOL', value: symbol.toUpperCase() }
    }
    const tag = (item.tags || []).map((value) => value.trim()).find(Boolean)
    if (tag) {
      return { followType: 'TAG', value: tag.toLowerCase() }
    }
    return null
  }

  const isItemFollowed = (item: ContentPost) => {
    const target = resolveFollowTarget(item)
    if (!target) return false
    return followedSet.has(`${target.followType}:${target.value}`)
  }

  const handleFollow = async (item: ContentPost) => {
    setFollowError('')
    setFollowMessage('')
    const target = resolveFollowTarget(item)
    if (!target) {
      setFollowError(t('insights.errors.follow'))
      return
    }
    try {
      await createFollow(target)
      await followsQuery.refetch()
      setFollowMessage(t('insights.messages.followed'))
    } catch {
      setFollowError(t('insights.errors.follow'))
    }
  }

  useEffect(() => {
    if (!canLoadMore || !loadMoreRef.current) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(current + 8, filteredItems.length))
      }
    }, { rootMargin: '320px' })

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [canLoadMore, filteredItems.length])

  const clearFilters = () => {
    setTagFilter('')
    setSymbolFilter('')
    setSecondaryType('')
  }

  const isLoading = feedQuery.isLoading || contentTypesQuery.isLoading
  const hasFeaturedPlanError = (activeTab === 'today' && featuredDailyQuery.isError)
    || (activeTab === 'week' && featuredWeeklyQuery.isError)
  const hasError = feedQuery.isError || contentTypesQuery.isError || hasFeaturedPlanError

  return (
    <Stack spacing={2.5} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.7rem', sm: '2rem' },
            lineHeight: 1.2,
            overflowWrap: 'anywhere'
          }}
        >
          {t('insights.heading')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: { xs: '100%', md: '78ch' }, overflowWrap: 'anywhere' }}
        >
          {t('insights.subheading')}
        </Typography>
      </Stack>

      <Card sx={{ overflow: 'hidden' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value: InsightsTab) => {
                const next = TAB_CONFIGS.find((config) => config.key === value)
                if (!next) return
                navigate(next.path)
              }}
              variant="scrollable"
              allowScrollButtonsMobile
              scrollButtons="auto"
              aria-label={t('nav.insights')}
              sx={{
                width: '100%',
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTabs-flexContainer': { gap: 1 },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  minHeight: 44,
                  minWidth: 'fit-content',
                  flexShrink: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 999,
                  px: 1.5,
                  color: 'text.secondary'
                },
                '& .MuiTab-root.Mui-selected': {
                  color: 'text.primary',
                  borderColor: 'primary.main',
                  bgcolor: 'action.selected'
                }
              }}
            >
              <Tab value="today" label={t('insights.tabs.today')} />
              <Tab value="week" label={t('insights.tabs.week')} />
              <Tab value="playbooks" label={t('insights.tabs.playbooks')} />
              <Tab value="learn" label={t('insights.tabs.learn')} />
            </Tabs>

            <FilterBar
              search={search}
              tagFilter={tagFilter}
              symbolFilter={symbolFilter}
              secondaryType={secondaryType}
              secondaryTypeOptions={secondaryOptions}
              onSearchChange={setSearch}
              onTagFilterChange={setTagFilter}
              onSymbolFilterChange={setSymbolFilter}
              onSecondaryTypeChange={setSecondaryType}
              onReset={clearFilters}
            />
          </Stack>
        </CardContent>
      </Card>

      {hasError && <ErrorBanner message={t('insights.errors.load')} />}
      {followError && <ErrorBanner message={followError} />}
      {followMessage && (
        <Card>
          <CardContent>
            <Typography variant="body2">{followMessage}</Typography>
          </CardContent>
        </Card>
      )}

      {featuredCard && (
        <Card>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {t('insights.featured')}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {featuredCard.title}
              </Typography>
              {featuredCard.summary && (
                <Typography variant="body2" color="text.secondary">
                  {featuredCard.summary}
                </Typography>
              )}
              {featuredCard.updatedAt && (
                <Typography variant="caption" color="text.secondary">
                  {t('insights.updated')} {formatDateTime(featuredCard.updatedAt)}
                </Typography>
              )}
              <Button component={Link} to={featuredCard.ctaPath} size="small" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                {featuredCard.ctaLabel}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent>
            <LoadingState rows={4} height={32} />
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={t(`insights.empty.${activeTab}Title`)}
          description={t(`insights.empty.${activeTab}Body`)}
        />
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('nav.insights')}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
              minWidth: 0,
              '& > *': { minWidth: 0 }
            }}
          >
            {visibleItems.map((item) => {
              const openPath = `/insights/${item.slug || item.id}`
              if (activeTab === 'playbooks') {
                return (
                  <StrategyCard
                    key={item.id}
                    item={item}
                    openPath={openPath}
                    onFollow={handleFollow}
                    isFollowing={isItemFollowed(item)}
                  />
                )
              }
              return (
                <ContentCard
                  key={item.id}
                  item={item}
                  displayTypeLabel={item.contentTypeDisplayName || item.contentTypeKey}
                  openPath={openPath}
                  onFollow={handleFollow}
                  isFollowing={isItemFollowed(item)}
                />
              )
            })}
          </Box>

          {canLoadMore && (
            <Stack alignItems="center" spacing={1}>
              <Box ref={loadMoreRef} sx={{ width: '100%', height: 1 }} />
              <Button variant="outlined" onClick={() => setVisibleCount((current) => Math.min(current + 8, filteredItems.length))}>
                {t('insights.actions.loadMore')}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  )
}
