import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import { ApiError } from '../api/client'
import { ContentPost, ContentType, listContentTypes, listPublishedContent } from '../api/content'
import { formatDate, formatDateTime } from '../utils/format'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

const parseCsv = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const normalize = (value: string) => value.trim().toLowerCase()

export default function InsightsPage() {
  const { t } = useI18n()
  const isCompact = useMediaQuery('(max-width:560px)')
  const [types, setTypes] = useState<ContentType[]>([])
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [items, setItems] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    loadTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchContent()
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, types.length])

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

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Tabs
              value={types.length === 0 ? false : tab}
              onChange={(_, value) => setTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              scrollButtons={isCompact ? true : 'auto'}
            >
              {types.map((item) => (
                <Tab key={item.id} label={item.displayName} />
              ))}
            </Tabs>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder={t('insights.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  placeholder={t('insights.tagsPlaceholder')}
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  placeholder={t('insights.symbolsPlaceholder')}
                  value={symbolFilter}
                  onChange={(event) => setSymbolFilter(event.target.value)}
                />
              </Grid>
            </Grid>
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
        <Grid container spacing={2}>
          {filteredItems.map((item) => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={2} height="100%">
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      {item.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {item.summary}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={item.contentTypeDisplayName || item.contentTypeKey} size="small" color="primary" />
                      {(item.tags || []).slice(0, 3).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                      {(item.symbols || []).slice(0, 3).map((symbol) => (
                        <Chip key={symbol} label={symbol} size="small" variant="outlined" />
                      ))}
                    </Stack>
                    {item.contentTypeKey === 'WEEKLY_PLAN' && item.weekStart && item.weekEnd && (
                      <Typography variant="body2" color="text.secondary">
                        {t('insights.weekOf')} {formatDate(item.weekStart)} - {formatDate(item.weekEnd)}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('insights.updated')} {formatDateTime(item.updatedAt || item.publishedAt || '')}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      variant="outlined"
                      component={Link}
                      to={`/insights/${item.slug || item.id}`}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {t('common.viewDetails')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  )
}
