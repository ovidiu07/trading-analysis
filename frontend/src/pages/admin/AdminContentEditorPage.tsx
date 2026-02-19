import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useNavigate, useParams } from 'react-router-dom'
import AssetListRenderer, { type UploadQueueItem } from '../../components/assets/AssetListRenderer'
import AssetUploadDropzone from '../../components/assets/AssetUploadDropzone'
import LoadingState from '../../components/ui/LoadingState'
import MarkdownContent from '../../components/ui/MarkdownContent'
import { ApiError } from '../../api/client'
import {
  ContentPost,
  ContentPostRequest,
  ContentPostStatus,
  ContentType,
  archiveContent,
  createContentDraft,
  getAdminContent,
  listAdminContentTypes,
  publishContent,
  updateContent
} from '../../api/content'
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  deleteAsset,
  fetchAssetBlob,
  resolveAssetUrl,
  type AssetItem,
  uploadAsset
} from '../../api/assets'
import { formatDate, formatDateTime } from '../../utils/format'
import { useI18n } from '../../i18n'
import { translateApiError } from '../../i18n/errorMessages'
import {
  buildTranslationsPayload,
  copyLocaleContent,
  createDefaultTranslations,
  isLocaleMissing,
  type EditorLocale,
  type TranslationDraft,
  updateLocalizedField
} from './contentEditorState'
import {
  pruneTemplateFields,
  templateFieldRecordFromContent,
  templateFieldsForType
} from './contentTemplateConfig'

const buildWeeklyTemplate = (t: (key: string) => string) => [
  `## ${t('adminEditor.weeklyTemplate.focus')}`,
  '',
  `- ${t('adminEditor.weeklyTemplate.primaryTheme')}`,
  `- ${t('adminEditor.weeklyTemplate.riskCues')}`,
  '',
  `## ${t('adminEditor.weeklyTemplate.keyLevels')}`,
  '',
  '- ',
  '',
  `## ${t('adminEditor.weeklyTemplate.watchlist')}`,
  '',
  `- ${t('adminEditor.weeklyTemplate.watchlistHint')}`,
  '',
  `## ${t('adminEditor.weeklyTemplate.ifThen')}`,
  '',
  `- ${t('adminEditor.weeklyTemplate.ifThenHint')}`,
  '',
  `## ${t('adminEditor.weeklyTemplate.invalidation')}`,
  '',
  `- ${t('adminEditor.weeklyTemplate.invalidationHint')}`
].join('\n')

const parseCsv = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const joinCsv = (values?: string[] | null) => (values && values.length ? values.join(', ') : '')

const DAILY_ESSENTIAL_TEMPLATE_KEYS = new Set(['biasSummary', 'keyLevels', 'executionRules', 'riskNote'])
const DAILY_ADVANCED_TEMPLATE_KEYS = new Set(['liquidityNarrative', 'primaryModel', 'alternativeScenario', 'context'])
const TRADING_VIEW_INTERVAL_OPTIONS = ['1', '3', '5', '15', '30', '60', '240', 'D', 'W'] as const

const toInputDateTime = (value?: string | null) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

type ContentFormState = {
  contentTypeId: string
  slug: string
  tagsInput: string
  symbolsInput: string
  templateFields: Record<string, string>
  revisionNotes: string
  tradingViewSymbol: string
  tradingViewInterval: string
  tradingViewTheme: 'LIGHT' | 'DARK' | 'SYSTEM'
  tradingViewHideControls: boolean
  tradingViewAllowSymbolChange: boolean
  snapshotAssetId: string
  snapshotCaption: string
  visibleFrom: string
  visibleUntil: string
  weekStart: string
  weekEnd: string
  translations: TranslationDraft
}

const buildDefaultForm = (): ContentFormState => ({
  contentTypeId: '',
  slug: '',
  tagsInput: '',
  symbolsInput: '',
  templateFields: {},
  revisionNotes: '',
  tradingViewSymbol: '',
  tradingViewInterval: '15',
  tradingViewTheme: 'SYSTEM',
  tradingViewHideControls: true,
  tradingViewAllowSymbolChange: false,
  snapshotAssetId: '',
  snapshotCaption: '',
  visibleFrom: '',
  visibleUntil: '',
  weekStart: '',
  weekEnd: '',
  translations: createDefaultTranslations()
})

const toForm = (post: ContentPost): ContentFormState => ({
  contentTypeId: post.contentTypeId,
  slug: post.slug || '',
  tagsInput: joinCsv(post.tags),
  symbolsInput: joinCsv(post.symbols),
  templateFields: templateFieldRecordFromContent(post.contentTypeKey, post.templateFields),
  revisionNotes: post.revisionNotes || '',
  tradingViewSymbol: post.tradingViewSymbol || '',
  tradingViewInterval: post.tradingViewInterval || '15',
  tradingViewTheme: (post.tradingViewTheme as 'LIGHT' | 'DARK' | 'SYSTEM' | null) || 'SYSTEM',
  tradingViewHideControls: post.tradingViewHideControls ?? true,
  tradingViewAllowSymbolChange: post.tradingViewAllowSymbolChange ?? false,
  snapshotAssetId: post.snapshotAssetId || '',
  snapshotCaption: post.snapshotCaption || '',
  visibleFrom: toInputDateTime(post.visibleFrom),
  visibleUntil: toInputDateTime(post.visibleUntil),
  weekStart: post.weekStart || '',
  weekEnd: post.weekEnd || '',
  translations: createDefaultTranslations(post.translations ?? undefined, {
    title: post.title,
    summary: post.summary,
    body: post.body,
    resolvedLocale: (post.resolvedLocale as 'en' | 'ro' | undefined) ?? 'en'
  })
})

export default function AdminContentEditorPage() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const isDesktop = useMediaQuery('(min-width:1024px)')
  const [form, setForm] = useState<ContentFormState>(buildDefaultForm)
  const [types, setTypes] = useState<ContentType[]>([])
  const [activeLocale, setActiveLocale] = useState<EditorLocale>('en')
  const [post, setPost] = useState<ContentPost | null>(null)
  const [status, setStatus] = useState<ContentPostStatus>('DRAFT')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(isDesktop)
  const [confirmAction, setConfirmAction] = useState<'publish' | 'archive' | null>(null)
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [notifySubscribersAboutUpdate, setNotifySubscribersAboutUpdate] = useState(true)
  const bodyInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setShowPreview(isDesktop)
  }, [isDesktop])

  useEffect(() => {
    setLoading(true)
    setError('')

    Promise.all([
      listAdminContentTypes({ includeInactive: true }),
      id ? getAdminContent(id) : Promise.resolve(null)
    ])
      .then(([loadedTypes, loadedPost]) => {
        setTypes(loadedTypes)

        if (loadedPost) {
          setPost(loadedPost)
          setStatus(loadedPost.status)
          setNotifySubscribersAboutUpdate(true)
          setForm(toForm(loadedPost))
          setAssets(loadedPost.assets || [])
          setUploadQueue([])
          return
        }

        setAssets([])
        setUploadQueue([])
        setNotifySubscribersAboutUpdate(true)
        const firstType = loadedTypes.find((item) => item.active) || loadedTypes[0]
        setForm((prev) => ({
          ...prev,
          contentTypeId: prev.contentTypeId || firstType?.id || '',
          templateFields: firstType?.key
            ? templateFieldRecordFromContent(firstType.key, prev.templateFields)
            : {}
        }))
      })
      .catch((err) => {
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t))
      })
      .finally(() => setLoading(false))
  }, [id, t, language])

  const selectedType = useMemo(() => types.find((type) => type.id === form.contentTypeId) || null, [types, form.contentTypeId])
  const isWeeklyPlan = selectedType?.key === 'WEEKLY_PLAN'
  const isDailyPlan = selectedType?.key === 'DAILY_PLAN'
  const templateDefinitions = useMemo(
    () => templateFieldsForType(selectedType?.key || post?.contentTypeKey),
    [post?.contentTypeKey, selectedType?.key]
  )
  const dailyEssentialDefinitions = useMemo(
    () => templateDefinitions.filter((item) => DAILY_ESSENTIAL_TEMPLATE_KEYS.has(item.key)),
    [templateDefinitions]
  )
  const dailyAdvancedDefinitions = useMemo(
    () => templateDefinitions.filter((item) => DAILY_ADVANCED_TEMPLATE_KEYS.has(item.key)),
    [templateDefinitions]
  )
  const roMissing = isLocaleMissing(form.translations, 'ro')
  const snapshotAsset = useMemo(
    () => assets.find((asset) => asset.id === form.snapshotAssetId) || null,
    [assets, form.snapshotAssetId]
  )
  const templatePreviewEntries = useMemo(
    () => (isDailyPlan ? dailyEssentialDefinitions : templateDefinitions)
      .map((templateField) => ({
        ...templateField,
        value: form.templateFields[templateField.key]?.trim() || ''
      }))
      .filter((templateField) => templateField.value),
    [dailyEssentialDefinitions, form.templateFields, isDailyPlan, templateDefinitions]
  )

  useEffect(() => {
    if (!isDailyPlan || form.tradingViewSymbol.trim()) {
      return
    }
    const firstSymbol = parseCsv(form.symbolsInput)[0]
    if (!firstSymbol) {
      return
    }
    setForm((prev) => (prev.tradingViewSymbol.trim()
      ? prev
      : { ...prev, tradingViewSymbol: firstSymbol.toUpperCase() }))
  }, [form.symbolsInput, form.tradingViewSymbol, isDailyPlan])

  const buildPayload = (): ContentPostRequest => ({
    contentTypeId: form.contentTypeId,
    slug: form.slug.trim() ? form.slug.trim() : undefined,
    tags: parseCsv(form.tagsInput),
    symbols: parseCsv(form.symbolsInput),
    templateFields: pruneTemplateFields(form.templateFields),
    revisionNotes: form.revisionNotes.trim() || undefined,
    tradingViewSymbol: form.tradingViewSymbol.trim() || undefined,
    tradingViewInterval: form.tradingViewSymbol.trim() ? form.tradingViewInterval : undefined,
    tradingViewTheme: form.tradingViewSymbol.trim() ? form.tradingViewTheme : undefined,
    tradingViewHideControls: form.tradingViewSymbol.trim() ? form.tradingViewHideControls : undefined,
    tradingViewAllowSymbolChange: form.tradingViewSymbol.trim() ? form.tradingViewAllowSymbolChange : undefined,
    snapshotAssetId: form.snapshotAssetId || undefined,
    snapshotCaption: form.snapshotAssetId ? (form.snapshotCaption.trim() || undefined) : undefined,
    visibleFrom: form.visibleFrom ? new Date(form.visibleFrom).toISOString() : undefined,
    visibleUntil: form.visibleUntil ? new Date(form.visibleUntil).toISOString() : undefined,
    weekStart: isWeeklyPlan ? (form.weekStart || undefined) : undefined,
    weekEnd: isWeeklyPlan ? (form.weekEnd || undefined) : undefined,
    notifySubscribersAboutUpdate: status === 'PUBLISHED' ? notifySubscribersAboutUpdate : undefined,
    translations: buildTranslationsPayload(form.translations)
  })

  const validate = () => {
    const errors: Record<string, string> = {}

    if (!form.contentTypeId) {
      errors.contentTypeId = t('adminEditor.validation.typeRequired')
    }

    if (!form.translations.en.title.trim()) {
      errors.enTitle = t('adminEditor.validation.titleRequired')
    }

    if (!isDailyPlan && !form.translations.en.body.trim()) {
      errors.enBody = t('adminEditor.validation.bodyRequired')
    }

    const roHasAnyContent = Boolean(
      form.translations.ro.title.trim() ||
      form.translations.ro.summary.trim() ||
      form.translations.ro.body.trim()
    )

    if (roHasAnyContent && !form.translations.ro.title.trim()) {
      errors.roTitle = t('adminEditor.validation.localeTitleRequired', { locale: 'RO' })
    }

    if (!isDailyPlan && roHasAnyContent && !form.translations.ro.body.trim()) {
      errors.roBody = t('adminEditor.validation.localeBodyRequired', { locale: 'RO' })
    }

    if (isWeeklyPlan) {
      if (!form.weekStart) {
        errors.weekStart = t('adminEditor.validation.weekStartRequired')
      }
      if (!form.weekEnd) {
        errors.weekEnd = t('adminEditor.validation.weekEndRequired')
      }
      if (form.weekStart && form.weekEnd && form.weekStart > form.weekEnd) {
        errors.weekEnd = t('adminEditor.validation.weekEndAfterStart')
      }
    }

    templateDefinitions.forEach((field) => {
      if (!field.required) {
        return
      }
      const value = form.templateFields[field.key] || ''
      if (!value.trim()) {
        errors[`template.${field.key}`] = t('adminEditor.validation.templateFieldRequired', {
          field: t(field.labelKey)
        })
      }
    })

    if (form.visibleFrom && form.visibleUntil && form.visibleFrom > form.visibleUntil) {
      errors.visibleUntil = t('adminEditor.validation.visibleUntilAfterFrom')
    }

    if (form.tradingViewSymbol.trim() && !/^[A-Za-z0-9:._-]+$/.test(form.tradingViewSymbol.trim())) {
      errors.tradingViewSymbol = t('adminEditor.validation.tradingViewSymbol')
    }

    if (form.tradingViewSymbol.trim() && !TRADING_VIEW_INTERVAL_OPTIONS.includes(form.tradingViewInterval as (typeof TRADING_VIEW_INTERVAL_OPTIONS)[number])) {
      errors.tradingViewInterval = t('adminEditor.validation.tradingViewInterval')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveDraft = async () => {
    if (!validate()) return null
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload()
      const saved = post
        ? await updateContent(post.id, payload)
        : await createContentDraft(payload)
      setPost(saved)
      setStatus(saved.status)
      setForm(toForm(saved))
      setAssets(saved.assets || [])
      if (!post) {
        navigate(`/admin/content/${saved.id}`, { replace: true })
      }
      return saved
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t, 'adminEditor.errors.saveFailed'))
      return null
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    const saved = await saveDraft()
    if (!saved) return
    setSaving(true)
    try {
      const published = await publishContent(saved.id)
      setPost(published)
      setStatus(published.status)
      setForm(toForm(published))
      setAssets(published.assets || [])
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t, 'adminEditor.errors.publishFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!post) return
    setSaving(true)
    try {
      const archived = await archiveContent(post.id)
      setPost(archived)
      setStatus(archived.status)
      setForm(toForm(archived))
      setAssets(archived.assets || [])
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t, 'adminEditor.errors.archiveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmAction = async () => {
    if (confirmAction === 'publish') {
      await handlePublish()
    }
    if (confirmAction === 'archive') {
      await handleArchive()
    }
    setConfirmAction(null)
  }

  const updateUploadQueueItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const ensurePostForAssets = async () => {
    if (post) return post
    const saved = await saveDraft()
    if (!saved) {
      setError(t('adminEditor.errors.saveBeforeUpload'))
      return null
    }
    return saved
  }

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    const targetPost = await ensurePostForAssets()
    if (!targetPost) return

    const queueItems = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      sizeBytes: file.size,
      progress: 2
    }))

    setUploadQueue((prev) => [...prev, ...queueItems])

    await Promise.all(queueItems.map(async (queueItem, index) => {
      const file = files[index]
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        updateUploadQueueItem(queueItem.id, {
          progress: 0,
          error: t('assets.errors.tooLarge')
        })
        return
      }
      if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
        updateUploadQueueItem(queueItem.id, {
          progress: 0,
          error: t('assets.errors.typeNotAllowed')
        })
        return
      }

      try {
        const uploaded = await uploadAsset({
          file,
          scope: 'CONTENT',
          contentId: targetPost.id,
          onProgress: (progress) => updateUploadQueueItem(queueItem.id, { progress })
        })
        setAssets((prev) => [...prev, uploaded])
        setUploadQueue((prev) => prev.filter((item) => item.id !== queueItem.id))
      } catch (err) {
        const apiErr = err as ApiError
        updateUploadQueueItem(queueItem.id, {
          progress: 0,
          error: translateApiError(apiErr, t, 'adminEditor.errors.uploadFailed')
        })
      }
    }))
  }

  const handleRemoveAsset = async (asset: AssetItem) => {
    try {
      await deleteAsset(asset.id)
      setAssets((prev) => prev.filter((item) => item.id !== asset.id))
      setForm((prev) => (prev.snapshotAssetId === asset.id
        ? { ...prev, snapshotAssetId: '', snapshotCaption: '' }
        : prev))
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t, 'adminEditor.errors.deleteAssetFailed'))
    }
  }

  const handleSetSnapshot = (asset: AssetItem) => {
    if (!asset.image) return
    setForm((prev) => ({
      ...prev,
      snapshotAssetId: prev.snapshotAssetId === asset.id ? '' : asset.id,
      snapshotCaption: prev.snapshotAssetId === asset.id ? '' : prev.snapshotCaption
    }))
  }

  const handleCopyAssetLink = async (asset: AssetItem) => {
    const raw = asset.url || asset.downloadUrl || asset.viewUrl
    if (!raw) return
    try {
      await navigator.clipboard.writeText(resolveAssetUrl(raw))
    } catch {
      setError(t('adminEditor.errors.copyLinkFailed'))
    }
  }

  const handleInsertAssetIntoBody = (asset: AssetItem) => {
    const targetUrl = resolveAssetUrl(asset.image ? (asset.viewUrl || asset.url || '') : (asset.downloadUrl || asset.url || ''))
    if (!targetUrl) return
    const current = form.translations[activeLocale].body
    const input = bodyInputRef.current
    const start = input?.selectionStart ?? current.length
    const end = input?.selectionEnd ?? current.length
    const markdown = asset.image
      ? `![${asset.originalFileName}](${targetUrl})`
      : `[${asset.originalFileName}](${targetUrl})`
    const nextValue = `${current.slice(0, start)}${markdown}${current.slice(end)}`
    setForm((prev) => ({
      ...prev,
      translations: updateLocalizedField(prev.translations, activeLocale, { body: nextValue })
    }))
    window.setTimeout(() => {
      const nextPosition = start + markdown.length
      input?.focus()
      input?.setSelectionRange(nextPosition, nextPosition)
    }, 0)
  }

  const handleDownloadAsset = async (asset: AssetItem) => {
    const downloadUrl = asset.downloadUrl || asset.url || asset.viewUrl
    if (!downloadUrl) return
    if (downloadUrl.startsWith('/api/')) {
      try {
        const blob = await fetchAssetBlob(downloadUrl)
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
        setError(translateApiError(apiErr, t, 'adminEditor.errors.downloadAssetFailed'))
      }
      return
    }
    window.open(resolveAssetUrl(downloadUrl), '_blank', 'noopener,noreferrer')
  }

  const statusChip = useMemo(() => {
    const color = status === 'PUBLISHED' ? 'success' : status === 'ARCHIVED' ? 'default' : 'warning'
    return <Chip label={t(`adminContent.statuses.${status.toLowerCase()}`)} color={color} size="small" />
  }, [status, t])

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LoadingState rows={4} height={32} />
        </CardContent>
      </Card>
    )
  }

  const activeTranslation = form.translations[activeLocale]
  const activeLocaleUpper = activeLocale.toUpperCase()
  const roIsMissing = (post?.missingLocales || []).includes('ro') || roMissing

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {statusChip}
          {roIsMissing && (
            <Typography variant="caption" color="warning.main">{t('adminContent.badges.roMissing')}</Typography>
          )}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" onClick={saveDraft} disabled={saving}>
            {saving ? t('adminEditor.actions.saving') : t('adminEditor.actions.saveDraft')}
          </Button>
          <Button
            variant="contained"
            onClick={() => setConfirmAction('publish')}
            disabled={saving || status === 'PUBLISHED'}
          >
            {t('adminEditor.actions.publish')}
          </Button>
          <Button
            variant="text"
            onClick={() => setConfirmAction('archive')}
            disabled={saving || status === 'ARCHIVED' || !post}
          >
            {t('adminEditor.actions.archive')}
          </Button>
        </Stack>
      </Stack>

      {status === 'PUBLISHED' && (
        <FormControlLabel
          control={(
            <Checkbox
              checked={notifySubscribersAboutUpdate}
              onChange={(event) => setNotifySubscribersAboutUpdate(event.target.checked)}
            />
          )}
          label={t('adminEditor.fields.notifySubscribersAboutUpdate')}
        />
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" color="text.secondary">
                    {post ? t('adminEditor.title.edit') : t('adminEditor.title.create')}
                  </Typography>
                  {(post?.updatedAt || post?.contentVersion) && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {post?.contentVersion ? (
                        <Chip
                          size="small"
                          label={t('adminEditor.versionChip', { version: post.contentVersion })}
                          variant="outlined"
                        />
                      ) : null}
                      {post?.updatedAt ? (
                        <Typography variant="caption" color="text.secondary">
                          {t('adminEditor.updated')} {formatDateTime(post.updatedAt)}
                        </Typography>
                      ) : null}
                    </Stack>
                  )}
                </Stack>

                <TextField
                  select
                  label={t('adminEditor.fields.type')}
                  value={form.contentTypeId}
                  onChange={(event) => {
                    const nextId = event.target.value
                    const nextType = types.find((item) => item.id === nextId)
                    setForm((prev) => ({
                      ...prev,
                      contentTypeId: nextId,
                      templateFields: nextType?.key
                        ? templateFieldRecordFromContent(nextType.key, prev.templateFields)
                        : {}
                    }))
                  }}
                  error={Boolean(fieldErrors.contentTypeId)}
                  helperText={fieldErrors.contentTypeId}
                >
                  {types.map((contentType) => (
                    <MenuItem key={contentType.id} value={contentType.id}>
                      {contentType.displayName}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label={t('adminEditor.fields.slug')}
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                  helperText={t('adminEditor.fields.slugHint')}
                />

                <Divider />

                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                  <Tabs value={activeLocale} onChange={(_, value) => setActiveLocale(value)}>
                    <Tab value="en" label="EN" />
                    <Tab value="ro" label="RO" />
                  </Tabs>
                  {roMissing && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        translations: {
                          ...prev.translations,
                          ro: copyLocaleContent(prev.translations.en)
                        }
                      }))}
                    >
                      {t('adminEditor.actions.copyEnToRo')}
                    </Button>
                  )}
                </Stack>

                <TextField
                  label={`${t('adminEditor.fields.title')} (${activeLocaleUpper})`}
                  value={activeTranslation.title}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    translations: updateLocalizedField(prev.translations, activeLocale, { title: event.target.value })
                  }))}
                  error={Boolean(activeLocale === 'en' ? fieldErrors.enTitle : fieldErrors.roTitle)}
                  helperText={activeLocale === 'en' ? fieldErrors.enTitle : fieldErrors.roTitle}
                  required={activeLocale === 'en'}
                />

                <TextField
                  label={`${t('adminEditor.fields.summary')} (${activeLocaleUpper})`}
                  value={activeTranslation.summary}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    translations: updateLocalizedField(prev.translations, activeLocale, { summary: event.target.value })
                  }))}
                  multiline
                  minRows={2}
                />

                {!isDailyPlan && (
                  <TextField
                    label={`${t('adminEditor.fields.body')} (${activeLocaleUpper})`}
                    value={activeTranslation.body}
                    inputRef={bodyInputRef}
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      translations: updateLocalizedField(prev.translations, activeLocale, { body: event.target.value })
                    }))}
                    multiline
                    minRows={10}
                    error={Boolean(activeLocale === 'en' ? fieldErrors.enBody : fieldErrors.roBody)}
                    helperText={(activeLocale === 'en' ? fieldErrors.enBody : fieldErrors.roBody) || t('adminEditor.fields.bodyHint')}
                    required={activeLocale === 'en'}
                  />
                )}

                {isWeeklyPlan && (
                  <Button
                    variant="outlined"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      translations: updateLocalizedField(prev.translations, activeLocale, {
                        body: prev.translations[activeLocale].body
                          ? `${prev.translations[activeLocale].body}\n\n${buildWeeklyTemplate(t)}`
                          : buildWeeklyTemplate(t)
                      })
                    }))}
                  >
                    {t('adminEditor.actions.insertWeeklyTemplate')}
                  </Button>
                )}

                {isDailyPlan ? (
                  <>
                    {dailyEssentialDefinitions.length > 0 && (
                      <>
                        <Divider />
                        <Stack spacing={1.25}>
                          <Typography variant="subtitle2">{t('adminEditor.sections.essentials')}</Typography>
                          {dailyEssentialDefinitions.map((templateField) => (
                            <TextField
                              key={templateField.key}
                              label={t(templateField.labelKey)}
                              placeholder={t(templateField.hintKey)}
                              value={form.templateFields[templateField.key] || ''}
                              onChange={(event) => setForm((prev) => ({
                                ...prev,
                                templateFields: {
                                  ...prev.templateFields,
                                  [templateField.key]: event.target.value
                                }
                              }))}
                              error={Boolean(fieldErrors[`template.${templateField.key}`])}
                              helperText={fieldErrors[`template.${templateField.key}`] || t(templateField.hintKey)}
                              required={Boolean(templateField.required)}
                              multiline
                              minRows={templateField.minRows || 2}
                            />
                          ))}
                        </Stack>
                      </>
                    )}

                    <Divider />
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle2">{t('adminEditor.sections.chart')}</Typography>
                      <TextField
                        label={t('adminEditor.fields.tradingViewSymbol')}
                        value={form.tradingViewSymbol}
                        onChange={(event) => setForm((prev) => ({ ...prev, tradingViewSymbol: event.target.value }))}
                        error={Boolean(fieldErrors.tradingViewSymbol)}
                        helperText={fieldErrors.tradingViewSymbol || t('adminEditor.fields.tradingViewSymbolHint')}
                      />
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            select
                            fullWidth
                            label={t('adminEditor.fields.tradingViewInterval')}
                            value={form.tradingViewInterval}
                            onChange={(event) => setForm((prev) => ({ ...prev, tradingViewInterval: event.target.value }))}
                            error={Boolean(fieldErrors.tradingViewInterval)}
                            helperText={fieldErrors.tradingViewInterval}
                          >
                            {TRADING_VIEW_INTERVAL_OPTIONS.map((interval) => (
                              <MenuItem key={interval} value={interval}>{interval}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            select
                            fullWidth
                            label={t('adminEditor.fields.tradingViewTheme')}
                            value={form.tradingViewTheme}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              tradingViewTheme: event.target.value as 'LIGHT' | 'DARK' | 'SYSTEM'
                            }))}
                          >
                            <MenuItem value="SYSTEM">{t('adminEditor.fields.themeSystem')}</MenuItem>
                            <MenuItem value="LIGHT">{t('adminEditor.fields.themeLight')}</MenuItem>
                            <MenuItem value="DARK">{t('adminEditor.fields.themeDark')}</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Stack spacing={0.25} sx={{ pt: { xs: 0, md: 0.5 } }}>
                            <FormControlLabel
                              control={(
                                <Checkbox
                                  checked={form.tradingViewHideControls}
                                  onChange={(event) => setForm((prev) => ({ ...prev, tradingViewHideControls: event.target.checked }))}
                                />
                              )}
                              label={t('adminEditor.fields.tradingViewHideControls')}
                            />
                            <FormControlLabel
                              control={(
                                <Checkbox
                                  checked={form.tradingViewAllowSymbolChange}
                                  onChange={(event) => setForm((prev) => ({ ...prev, tradingViewAllowSymbolChange: event.target.checked }))}
                                />
                              )}
                              label={t('adminEditor.fields.tradingViewAllowSymbolChange')}
                            />
                          </Stack>
                        </Grid>
                      </Grid>

                      {form.snapshotAssetId && (
                        <TextField
                          label={t('adminEditor.fields.snapshotCaption')}
                          value={form.snapshotCaption}
                          onChange={(event) => setForm((prev) => ({ ...prev, snapshotCaption: event.target.value }))}
                          placeholder={t('adminEditor.fields.snapshotCaptionHint')}
                          multiline
                          minRows={2}
                        />
                      )}

                      {snapshotAsset?.image && (
                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 1.25,
                            bgcolor: 'background.default'
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('adminEditor.previewSnapshot')}
                          </Typography>
                          <Box
                            component="img"
                            src={resolveAssetUrl(snapshotAsset.viewUrl || snapshotAsset.url || '')}
                            alt={snapshotAsset.originalFileName}
                            sx={{ display: 'block', width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 1.5, mt: 0.75 }}
                          />
                        </Box>
                      )}
                    </Stack>

                    <Accordion disableGutters sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                        <Typography variant="subtitle2">{t('adminEditor.sections.advanced')}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1.25}>
                          {dailyAdvancedDefinitions.map((templateField) => (
                            <TextField
                              key={templateField.key}
                              label={t(templateField.labelKey)}
                              placeholder={t(templateField.hintKey)}
                              value={form.templateFields[templateField.key] || ''}
                              onChange={(event) => setForm((prev) => ({
                                ...prev,
                                templateFields: {
                                  ...prev.templateFields,
                                  [templateField.key]: event.target.value
                                }
                              }))}
                              error={Boolean(fieldErrors[`template.${templateField.key}`])}
                              helperText={fieldErrors[`template.${templateField.key}`] || t(templateField.hintKey)}
                              required={Boolean(templateField.required)}
                              multiline
                              minRows={templateField.minRows || 2}
                            />
                          ))}

                          <TextField
                            label={`${t('adminEditor.fields.body')} (${activeLocaleUpper})`}
                            value={activeTranslation.body}
                            inputRef={bodyInputRef}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              translations: updateLocalizedField(prev.translations, activeLocale, { body: event.target.value })
                            }))}
                            multiline
                            minRows={8}
                            error={Boolean(activeLocale === 'en' ? fieldErrors.enBody : fieldErrors.roBody)}
                            helperText={(activeLocale === 'en' ? fieldErrors.enBody : fieldErrors.roBody) || t('adminEditor.fields.bodyHint')}
                          />
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  </>
                ) : (
                  templateDefinitions.length > 0 && (
                    <>
                      <Divider />
                      <Stack spacing={1.25}>
                        <Typography variant="subtitle2">
                          {t('adminEditor.template.sectionTitle')}
                        </Typography>
                        {templateDefinitions.map((templateField) => (
                          <TextField
                            key={templateField.key}
                            label={t(templateField.labelKey)}
                            placeholder={t(templateField.hintKey)}
                            value={form.templateFields[templateField.key] || ''}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              templateFields: {
                                ...prev.templateFields,
                                [templateField.key]: event.target.value
                              }
                            }))}
                            error={Boolean(fieldErrors[`template.${templateField.key}`])}
                            helperText={fieldErrors[`template.${templateField.key}`] || t(templateField.hintKey)}
                            required={Boolean(templateField.required)}
                            multiline
                            minRows={templateField.minRows || 2}
                          />
                        ))}
                      </Stack>
                    </>
                  )
                )}

                <Divider />
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2">{t('adminEditor.assets.title')}</Typography>
                  <AssetUploadDropzone
                    title={t('adminEditor.assets.dropTitle')}
                    hint={post ? t('adminEditor.assets.dropHint') : t('adminEditor.assets.saveFirstHint')}
                    buttonLabel={t('adminEditor.assets.selectFiles')}
                    onFilesSelected={handleUploadFiles}
                    disabled={saving || Boolean(uploadQueue.some((item) => !item.error && item.progress > 0 && item.progress < 100))}
                    multiple
                  />
                  <AssetListRenderer
                    assets={assets}
                    uploads={uploadQueue}
                    emptyText={t('adminEditor.assets.empty')}
                    onCopyLink={handleCopyAssetLink}
                    onInsert={handleInsertAssetIntoBody}
                    onSetSnapshot={isDailyPlan ? handleSetSnapshot : undefined}
                    onRemove={handleRemoveAsset}
                    onDownload={handleDownloadAsset}
                    copyLabel={t('adminEditor.assets.copyLink')}
                    insertLabel={t('adminEditor.assets.insertIntoBody')}
                    setSnapshotLabel={t('adminEditor.assets.setSnapshot')}
                    snapshotSelectedLabel={t('adminEditor.assets.snapshotSelected')}
                    snapshotAssetId={form.snapshotAssetId}
                    removeLabel={t('adminEditor.assets.remove')}
                    downloadLabel={t('adminEditor.assets.download')}
                  />
                </Stack>

                <Divider />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label={t('adminEditor.fields.tags')}
                      placeholder={t('adminEditor.fields.commaSeparated')}
                      value={form.tagsInput}
                      onChange={(event) => setForm((prev) => ({ ...prev, tagsInput: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label={t('adminEditor.fields.symbols')}
                      placeholder={t('adminEditor.fields.commaSeparated')}
                      value={form.symbolsInput}
                      onChange={(event) => setForm((prev) => ({ ...prev, symbolsInput: event.target.value }))}
                    />
                  </Grid>
                </Grid>

                {isWeeklyPlan && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('adminEditor.fields.weekStart')}
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={form.weekStart}
                        onChange={(event) => setForm((prev) => ({ ...prev, weekStart: event.target.value }))}
                        error={Boolean(fieldErrors.weekStart)}
                        helperText={fieldErrors.weekStart}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('adminEditor.fields.weekEnd')}
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={form.weekEnd}
                        onChange={(event) => setForm((prev) => ({ ...prev, weekEnd: event.target.value }))}
                        error={Boolean(fieldErrors.weekEnd)}
                        helperText={fieldErrors.weekEnd}
                      />
                    </Grid>
                  </Grid>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label={t('adminEditor.fields.visibleFrom')}
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={form.visibleFrom}
                      onChange={(event) => setForm((prev) => ({ ...prev, visibleFrom: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label={t('adminEditor.fields.visibleUntil')}
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={form.visibleUntil}
                      onChange={(event) => setForm((prev) => ({ ...prev, visibleUntil: event.target.value }))}
                      error={Boolean(fieldErrors.visibleUntil)}
                      helperText={fieldErrors.visibleUntil}
                    />
                  </Grid>
                </Grid>

                <TextField
                  label={t('adminEditor.fields.revisionNotes')}
                  placeholder={t('adminEditor.fields.revisionNotesHint')}
                  value={form.revisionNotes}
                  onChange={(event) => setForm((prev) => ({ ...prev, revisionNotes: event.target.value }))}
                  multiline
                  minRows={2}
                  helperText={t('adminEditor.fields.revisionNotesHelper')}
                />

                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="text" onClick={() => navigate('/admin/content')}>
                    {t('adminTypes.actions.backToContent')}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    {form.translations.en.title || t('adminEditor.newContent')}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          {!isDesktop && (
            <Button variant="outlined" onClick={() => setShowPreview((prev) => !prev)} sx={{ mb: 2 }}>
              {showPreview ? t('adminEditor.actions.hidePreview') : t('adminEditor.actions.showPreview')}
            </Button>
          )}
          {showPreview && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="text.secondary">{t('adminEditor.preview')} ({activeLocaleUpper})</Typography>
                  <Typography variant="h6">{activeTranslation.title || t('adminEditor.untitled')}</Typography>
                  {activeTranslation.summary && (
                    <Typography variant="body2" color="text.secondary">{activeTranslation.summary}</Typography>
                  )}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={selectedType?.displayName || t('adminEditor.fields.type')} size="small" color="primary" />
                    {parseCsv(form.tagsInput).map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {parseCsv(form.symbolsInput).map((symbol) => (
                      <Chip key={symbol} label={symbol} size="small" variant="outlined" />
                    ))}
                  </Stack>
                  {isWeeklyPlan && form.weekStart && form.weekEnd && (
                    <Typography variant="body2" color="text.secondary">
                      {t('insights.weekOf')} {formatDate(form.weekStart)} - {formatDate(form.weekEnd)}
                    </Typography>
                  )}
                  {templateDefinitions.length > 0 && (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">
                        {isDailyPlan ? t('adminEditor.sections.essentials') : t('adminEditor.template.previewTitle')}
                      </Typography>
                      {templatePreviewEntries.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('adminEditor.template.previewEmpty')}
                        </Typography>
                      ) : templatePreviewEntries.map((templateField) => (
                        <Stack key={`preview-${templateField.key}`} spacing={0.25}>
                          <Typography variant="caption" color="text.secondary">
                            {t(templateField.labelKey)}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {templateField.value}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}

                  {isDailyPlan && snapshotAsset?.image && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{t('adminEditor.previewSnapshot')}</Typography>
                      <Box
                        component="img"
                        src={resolveAssetUrl(snapshotAsset.viewUrl || snapshotAsset.url || '')}
                        alt={snapshotAsset.originalFileName}
                        sx={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
                      />
                      {form.snapshotCaption.trim() && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {form.snapshotCaption.trim()}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {isDailyPlan && form.tradingViewSymbol.trim() && (
                    <Box sx={{ p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                      <Typography variant="subtitle2">{t('adminEditor.previewWidgetTitle')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {form.tradingViewSymbol.trim()} • {form.tradingViewInterval} • {form.tradingViewTheme}
                      </Typography>
                    </Box>
                  )}

                  <MarkdownContent content={activeTranslation.body} />
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmAction === 'publish' ? t('adminContent.dialog.publishTitle') : t('adminContent.dialog.archiveTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction === 'publish'
              ? t('adminContent.dialog.publishBody')
              : t('adminContent.dialog.archiveBody')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmAction(null)} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleConfirmAction} disabled={saving}>
            {saving ? t('adminContent.actions.working') : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
