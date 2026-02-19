import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
  type ChipProps
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { Link, useParams } from 'react-router-dom'
import AssetListRenderer from '../components/assets/AssetListRenderer'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import PageHeader from '../components/ui/PageHeader'
import LoadingState from '../components/ui/LoadingState'
import ErrorBanner from '../components/ui/ErrorBanner'
import MarkdownContent from '../components/ui/MarkdownContent'
import { ApiError } from '../api/client'
import { fetchAssetBlob, resolveAssetUrl } from '../api/assets'
import { ContentPost, getContent } from '../api/content'
import { formatDate, formatDateTime } from '../utils/format'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

type ChipItem = {
  label: string
  variant: 'outlined' | 'filled'
  color?: ChipProps['color']
}

const toLineItems = (value?: string | null) => {
  if (!value) return []
  return value
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .filter(Boolean)
}

const formatTemplateLabel = (key: string) => key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, (value) => value.toUpperCase())

const normalizeTemplateText = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join('\n')
  }
  return String(value ?? '').trim()
}

export default function InsightDetailPage() {
  const { t, language } = useI18n()
  const { idOrSlug } = useParams()
  const isCompactViewport = useMediaQuery('(max-width:900px)')
  const [post, setPost] = useState<ContentPost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshAttempts, setRefreshAttempts] = useState(0)
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const translateRef = useRef(t)

  useEffect(() => {
    translateRef.current = t
  }, [t])

  const loadPost = useCallback(async () => {
    if (!idOrSlug) return
    setLoading(true)
    setError('')
    try {
      const data = await getContent(idOrSlug)
      setPost(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, translateRef.current))
    } finally {
      setLoading(false)
    }
  }, [idOrSlug])

  useEffect(() => {
    void loadPost()
  }, [loadPost])

  useEffect(() => {
    setRefreshAttempts(0)
  }, [idOrSlug])

  const localizedPost = useMemo<ContentPost | null>(() => {
    if (!post) return null
    const translation = post.translations?.[language]
    return {
      ...post,
      title: translation?.title || post.title,
      summary: translation?.summary ?? post.summary,
      body: translation?.body || post.body
    }
  }, [language, post])

  const chips = useMemo<ChipItem[]>(() => {
    if (!localizedPost) return []
    const tagChips: ChipItem[] = (localizedPost.tags || []).map((tag) => ({
      label: tag,
      variant: 'outlined',
      color: undefined
    }))
    const symbolChips: ChipItem[] = (localizedPost.symbols || []).map((symbol) => ({
      label: symbol,
      variant: 'outlined',
      color: undefined
    }))
    const typeChip: ChipItem = {
      label: localizedPost.contentTypeDisplayName || localizedPost.contentTypeKey,
      variant: 'filled',
      color: 'primary'
    }
    return [typeChip, ...tagChips, ...symbolChips]
  }, [localizedPost])

  const templateEntries = useMemo(() => {
    if (!localizedPost?.templateFields) {
      return []
    }
    return Object.entries(localizedPost.templateFields)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return { key, value: value.trim() }
        }
        if (Array.isArray(value)) {
          const normalized = value.map((item) => String(item)).join(', ').trim()
          return { key, value: normalized }
        }
        if (value && typeof value === 'object') {
          const normalized = Object.values(value as Record<string, unknown>)
            .map((item) => String(item))
            .join(', ')
            .trim()
          return { key, value: normalized }
        }
        return { key, value: String(value ?? '').trim() }
      })
      .filter((entry) => Boolean(entry.value))
  }, [localizedPost?.templateFields])

  const handleAttachmentImageError = () => {
    if (refreshAttempts >= 1 || loading) return
    setRefreshAttempts((prev) => prev + 1)
    void loadPost()
  }

  const handleDownloadAsset = async (asset: NonNullable<ContentPost['assets']>[number]) => {
    const targetUrl = asset.downloadUrl || asset.url || asset.viewUrl
    if (!targetUrl) return
    if (targetUrl.startsWith('/api/')) {
      try {
        const blob = await fetchAssetBlob(targetUrl)
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = asset.originalFileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      } catch (err) {
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t, 'insightDetail.errors.downloadFailed'))
      }
      return
    }
    window.open(resolveAssetUrl(targetUrl), '_blank', 'noopener,noreferrer')
  }

  if (loading && !localizedPost) {
    return (
      <Card>
        <CardContent>
          <LoadingState rows={4} height={32} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <ErrorBanner message={error} />
  }

  if (!localizedPost) {
    return null
  }

  const attachments = localizedPost.assets || []
  const isDailyPlan = localizedPost.contentTypeKey === 'DAILY_PLAN'

  const templateFieldValue = (key: string) => normalizeTemplateText(localizedPost.templateFields?.[key])
  const biasSummary = templateFieldValue('biasSummary') || (localizedPost.summary || '').trim()
  const keyLevels = toLineItems(templateFieldValue('keyLevels'))
  const executionRules = toLineItems(templateFieldValue('executionRules'))
  const riskNote = templateFieldValue('riskNote')
  const primaryModel = templateFieldValue('primaryModel')
  const liquidityNarrative = templateFieldValue('liquidityNarrative')
  const alternativeScenario = templateFieldValue('alternativeScenario')
  const context = templateFieldValue('context')
  const hasAdvancedDailyDetails = Boolean(
    primaryModel ||
    liquidityNarrative ||
    alternativeScenario ||
    context ||
    localizedPost.body?.trim()
  )

  const snapshotAsset = (localizedPost.snapshotAssetId
    ? attachments.find((asset) => asset.id === localizedPost.snapshotAssetId)
    : null) || null
  const snapshotUrl = snapshotAsset
    ? resolveAssetUrl(snapshotAsset.viewUrl || snapshotAsset.url || '')
    : ''

  return (
    <Stack spacing={3}>
      <PageHeader
        title={localizedPost.title}
        subtitle={localizedPost.summary || undefined}
        breadcrumbs={[
          <Button key="back" component={Link} to="/insights" size="small">{t('insights.title')}</Button>,
          <Typography key="current" variant="body2">{localizedPost.title}</Typography>
        ]}
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {chips.map((chip, index) => (
                <Chip
                  key={`${chip.label}-${index}`}
                  label={chip.label}
                  size="small"
                  variant={chip.variant}
                  color={chip.color}
                />
              ))}
            </Stack>
            {localizedPost.contentTypeKey === 'WEEKLY_PLAN' && localizedPost.weekStart && localizedPost.weekEnd && (
              <Typography variant="body2" color="text.secondary">
                {t('insights.weekOf')} {formatDate(localizedPost.weekStart)} - {formatDate(localizedPost.weekEnd)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('insightDetail.lastUpdated')} {formatDateTime(localizedPost.updatedAt || localizedPost.publishedAt || '')}
            </Typography>
            {localizedPost.revisionNotes && (
              <Typography variant="body2" color="text.secondary">
                {t('insightDetail.revisionNotes')} {localizedPost.revisionNotes}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {isDailyPlan ? (
            <Stack spacing={1.25}>
              {snapshotAsset?.image && snapshotUrl && (
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    {t('today.session.mentor.chartSnapshot')}
                  </Typography>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setSnapshotDialogOpen(true)}
                    sx={{
                      width: '100%',
                      p: 0,
                      border: 'none',
                      bgcolor: 'transparent',
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'zoom-in'
                    }}
                  >
                    <Box
                      component="img"
                      src={snapshotUrl}
                      alt={snapshotAsset.originalFileName || localizedPost.title}
                      sx={{
                        display: 'block',
                        width: '100%',
                        maxHeight: { xs: 300, md: 440 },
                        objectFit: 'cover',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  </Box>
                  {localizedPost.snapshotCaption && (
                    <Typography variant="caption" color="text.secondary">
                      {localizedPost.snapshotCaption}
                    </Typography>
                  )}
                </Stack>
              )}

              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  {t('today.session.mentor.essentials')}
                </Typography>
                <Grid container spacing={1.1}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.biasSummary')}</Typography>
                      <Typography variant="body2">{biasSummary || t('today.session.mentor.emptySummary')}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.keyLevels')}</Typography>
                      {keyLevels.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noKeyLevels')}</Typography>
                      ) : (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          {keyLevels.map((level) => (
                            <Chip key={level} size="small" label={level} variant="outlined" />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.executionRules')}</Typography>
                      {executionRules.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noExecutionRules')}</Typography>
                      ) : (
                        <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                          {executionRules.map((item, index) => (
                            <Typography key={`${item}-${index}`} variant="body2">{index + 1}. {item}</Typography>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.riskNote')}</Typography>
                      <Typography variant="body2">
                        {riskNote || t('today.session.mentor.noRiskNote')}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>

              {localizedPost.tradingViewSymbol && (
                <Accordion disableGutters defaultExpanded={!isCompactViewport}>
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Typography variant="body2">{t('today.session.mentor.liveChart')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TradingViewWidget
                      symbol={localizedPost.tradingViewSymbol}
                      interval={localizedPost.tradingViewInterval}
                      themePreference={localizedPost.tradingViewTheme || 'SYSTEM'}
                      hideControls={localizedPost.tradingViewHideControls ?? true}
                      allowSymbolChange={localizedPost.tradingViewAllowSymbolChange ?? false}
                      minHeight={isCompactViewport ? 320 : 420}
                      fallbackMessage={t('today.session.mentor.liveChartFallback')}
                      fallbackLinkLabel={t('today.session.mentor.openOnTradingView')}
                    />
                  </AccordionDetails>
                </Accordion>
              )}

              {hasAdvancedDailyDetails && (
                <Accordion disableGutters defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Typography variant="body2">{t('today.session.mentor.advanced')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.1}>
                      {primaryModel && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('today.session.mentor.primaryModel')}</Typography>
                          <Typography variant="body2">{primaryModel}</Typography>
                        </Box>
                      )}
                      {liquidityNarrative && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('today.session.mentor.liquidityNarrative')}</Typography>
                          <Typography variant="body2">{liquidityNarrative}</Typography>
                        </Box>
                      )}
                      {alternativeScenario && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('today.session.mentor.alternativeScenario')}</Typography>
                          <Typography variant="body2">{alternativeScenario}</Typography>
                        </Box>
                      )}
                      {context && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('today.session.mentor.context')}</Typography>
                          <Typography variant="body2">{context}</Typography>
                        </Box>
                      )}
                      {localizedPost.body && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('today.session.mentor.body')}</Typography>
                          <MarkdownContent content={localizedPost.body} />
                        </Box>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {templateEntries.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{t('insightDetail.templateFields')}</Typography>
                  {templateEntries.map((entry) => (
                    <Stack key={entry.key} spacing={0.25}>
                      <Typography variant="caption" color="text.secondary">
                        {formatTemplateLabel(entry.key)}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {entry.value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <MarkdownContent content={localizedPost.body} />
            </Stack>
          )}
        </CardContent>
      </Card>

      {attachments.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="h6">{t('insightDetail.attachments')}</Typography>
              <AssetListRenderer
                assets={attachments}
                emptyText={t('insightDetail.noAttachments')}
                onDownload={handleDownloadAsset}
                onImageError={handleAttachmentImageError}
                downloadLabel={t('common.download')}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      <Alert severity="info">
        {t('insightDetail.infoAlert')}
      </Alert>

      <Dialog
        open={snapshotDialogOpen && Boolean(snapshotUrl)}
        onClose={() => setSnapshotDialogOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{localizedPost.title || t('today.session.mentor.chartSnapshot')}</DialogTitle>
        <DialogContent dividers>
          {snapshotUrl && (
            <Box
              component="img"
              src={snapshotUrl}
              alt={localizedPost.title || t('today.session.mentor.chartSnapshot')}
              sx={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          )}
          {localizedPost.snapshotCaption && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {localizedPost.snapshotCaption}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnapshotDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
