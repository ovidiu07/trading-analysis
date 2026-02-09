import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TuneIcon from '@mui/icons-material/Tune'
import CloseIcon from '@mui/icons-material/Close'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import { ApiError } from '../api/client'
import { ContentPost, ContentType, listContentTypes, listPublishedContent } from '../api/content'
import { formatDate, formatDateTime } from '../utils/format'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { trackEvent } from '../utils/analytics/ga4'

const parseCsv = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const normalize = (value: string) => value.trim().toLowerCase()

export default function InsightsPage() {
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [types, setTypes] = useState<ContentType[]>([])
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [items, setItems] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const activeType = types[tab] || null
  const activeTypeKey = activeType?.key

  const loadTypes = async () => {
    try {
      const data = await listContentTypes()
      setTypes(data)
      setTab((current) => {
        if (data.length === 0) return 0
        return current >= data.length ? 0 : current
      })
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    }
  }

  const fetchContent = async (query = search, typeKey = activeTypeKey) => {
    setLoading(true)
    setError('')
    try {
      const data = await listPublishedContent({ type: typeKey, q: query, activeOnly: true })
      setItems(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    trackEvent('insights_view', {
      success: true,
      feature_area: 'insights'
    })
  }, [])

  useEffect(() => {
    loadTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchContent()
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTypeKey, search])

  const filteredItems = useMemo(() => {
    const tagTokens = parseCsv(tagFilter).map(normalize)
    const symbolTokens = parseCsv(symbolFilter).map(normalize)

    return items.filter((item) => {
      const tags = (item.tags || []).map(normalize)
      const symbols = (item.symbols || []).map(normalize)
      const tagMatch = tagTokens.length === 0 || tagTokens.every((token) => tags.includes(token))
      const symbolMatch = symbolTokens.length === 0 || symbolTokens.every((token) => symbols.includes(token))
      return tagMatch && symbolMatch
    })
  }, [items, tagFilter, symbolFilter])

  const emptyTitle = activeTypeKey === 'STRATEGY'
    ? t('insights.empty.strategiesTitle')
    : activeTypeKey === 'WEEKLY_PLAN'
      ? t('insights.empty.weeklyTitle')
      : t('insights.empty.defaultTitle')

  const emptyDescription = activeTypeKey === 'STRATEGY'
    ? t('insights.empty.strategiesBody')
    : activeTypeKey === 'WEEKLY_PLAN'
      ? t('insights.empty.weeklyBody')
      : t('insights.empty.defaultBody')

  const clearAdvancedFilters = () => {
    setTagFilter('')
    setSymbolFilter('')
  }

  const chipSx = {
    maxWidth: '100%',
    '& .MuiChip-label': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  } as const

  return (
    <Stack spacing={3} sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
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
          {t('nav.insights')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: { xs: '100%', md: '78ch' }, overflowWrap: 'anywhere' }}
        >
          {t('insights.subtitle')}
        </Typography>
      </Stack>

      <Card sx={{ overflow: 'hidden' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box sx={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
              <Tabs
                value={types.length === 0 ? false : tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                allowScrollButtonsMobile
                scrollButtons="auto"
                aria-label={t('nav.insights')}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  minHeight: 44,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTabs-scroller': {
                    overflowX: 'auto !important',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': {
                      display: 'none'
                    }
                  },
                  '& .MuiTabs-flexContainer': {
                    gap: 1
                  },
                  '& .MuiTabs-scrollButtons': {
                    color: 'text.secondary'
                  },
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
                {types.map((item) => (
                  <Tab key={item.id} label={item.displayName} />
                ))}
              </Tabs>
            </Box>

            {isMobile ? (
              <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                <TextField
                  fullWidth
                  placeholder={t('insights.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  inputProps={{ 'aria-label': t('insights.searchPlaceholder') }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<TuneIcon />}
                  onClick={() => setMobileFiltersOpen(true)}
                  fullWidth
                  sx={{ minHeight: 44 }}
                >
                  {t('dashboard.topBar.filters')}
                </Button>
              </Stack>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', md: '2fr 1fr 1fr' },
                  gap: 1.5,
                  alignItems: 'center',
                  minWidth: 0,
                  '& > *': {
                    minWidth: 0
                  }
                }}
              >
                <TextField
                  fullWidth
                  placeholder={t('insights.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}
                  inputProps={{ 'aria-label': t('insights.searchPlaceholder') }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  fullWidth
                  placeholder={t('insights.tagsPlaceholder')}
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  inputProps={{ 'aria-label': t('insights.tagsPlaceholder') }}
                />
                <TextField
                  fullWidth
                  placeholder={t('insights.symbolsPlaceholder')}
                  value={symbolFilter}
                  onChange={(event) => setSymbolFilter(event.target.value)}
                  inputProps={{ 'aria-label': t('insights.symbolsPlaceholder') }}
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading && items.length === 0 ? (
        <Card>
          <CardContent>
            <LoadingState rows={4} height={32} />
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <Box
          component="section"
          aria-label={t('nav.insights')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
            minWidth: 0,
            '& > *': {
              minWidth: 0
            }
          }}
        >
          {filteredItems.map((item) => {
            const tags = item.tags || []
            const symbols = item.symbols || []
            const visibleTags = tags.slice(0, 2)
            const visibleSymbols = symbols.slice(0, 2)
            const hiddenCount = Math.max(tags.length - visibleTags.length, 0) + Math.max(symbols.length - visibleSymbols.length, 0)

            return (
              <Card key={item.id} sx={{ height: '100%', minWidth: 0, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                  <Stack spacing={1.75} sx={{ minWidth: 0, height: '100%' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography component="h2" variant="h6" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                        {item.title}
                      </Typography>
                      {item.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
                          {item.summary}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ minWidth: 0 }}>
                      <Chip label={item.contentTypeDisplayName || item.contentTypeKey} size="small" color="primary" sx={chipSx} />
                      {visibleTags.map((tag) => (
                        <Chip key={`${item.id}-${tag}`} label={tag} size="small" variant="outlined" sx={chipSx} />
                      ))}
                      {visibleSymbols.map((symbol) => (
                        <Chip key={`${item.id}-${symbol}`} label={symbol} size="small" variant="outlined" sx={chipSx} />
                      ))}
                      {hiddenCount > 0 && (
                        <Chip label={`+${hiddenCount}`} size="small" variant="outlined" sx={chipSx} />
                      )}
                    </Stack>

                    {item.contentTypeKey === 'WEEKLY_PLAN' && item.weekStart && item.weekEnd && (
                      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                        {t('insights.weekOf')} {formatDate(item.weekStart)} - {formatDate(item.weekEnd)}
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      {t('insights.updated')} {formatDateTime(item.updatedAt || item.publishedAt || '')}
                    </Typography>

                    <Box sx={{ flexGrow: 1 }} />

                    <Button
                      variant="outlined"
                      component={Link}
                      to={`/insights/${item.slug || item.id}`}
                      aria-label={`${t('common.viewDetails')}: ${item.title}`}
                      sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, minHeight: 44 }}
                    >
                      {t('common.viewDetails')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      <Drawer
        anchor="bottom"
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        ModalProps={{ keepMounted: false }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: '100%',
            maxWidth: '100vw',
            px: 2,
            pt: 1.5,
            pb: 'calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid',
            borderColor: 'divider',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85dvh',
            overflowX: 'hidden',
            overflowY: 'auto'
          }
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0, height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('dashboard.topBar.filters')}
            </Typography>
            <IconButton
              onClick={() => setMobileFiltersOpen(false)}
              aria-label={t('dashboard.topBar.closeFilters')}
              sx={{ width: 44, height: 44 }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <TextField
            fullWidth
            placeholder={t('insights.tagsPlaceholder')}
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            inputProps={{ 'aria-label': t('insights.tagsPlaceholder') }}
          />
          <TextField
            fullWidth
            placeholder={t('insights.symbolsPlaceholder')}
            value={symbolFilter}
            onChange={(event) => setSymbolFilter(event.target.value)}
            inputProps={{ 'aria-label': t('insights.symbolsPlaceholder') }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" fullWidth onClick={clearAdvancedFilters}>
              {t('common.reset')}
            </Button>
            <Button variant="contained" fullWidth onClick={() => setMobileFiltersOpen(false)}>
              {t('common.apply')}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Stack>
  )
}
