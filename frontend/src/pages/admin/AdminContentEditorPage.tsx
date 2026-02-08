import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
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
          setForm(toForm(loadedPost))
          return
        }

        const firstType = loadedTypes.find((item) => item.active) || loadedTypes[0]
        setForm((prev) => ({
          ...prev,
          contentTypeId: prev.contentTypeId || firstType?.id || ''
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
  const roMissing = isLocaleMissing(form.translations, 'ro')

  const buildPayload = (): ContentPostRequest => ({
    contentTypeId: form.contentTypeId,
    slug: form.slug.trim() ? form.slug.trim() : undefined,
    tags: parseCsv(form.tagsInput),
    symbols: parseCsv(form.symbolsInput),
    visibleFrom: form.visibleFrom ? new Date(form.visibleFrom).toISOString() : undefined,
    visibleUntil: form.visibleUntil ? new Date(form.visibleUntil).toISOString() : undefined,
    weekStart: isWeeklyPlan ? (form.weekStart || undefined) : undefined,
    weekEnd: isWeeklyPlan ? (form.weekEnd || undefined) : undefined,
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

    if (!form.translations.en.body.trim()) {
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

    if (roHasAnyContent && !form.translations.ro.body.trim()) {
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

    if (form.visibleFrom && form.visibleUntil && form.visibleFrom > form.visibleUntil) {
      errors.visibleUntil = t('adminEditor.validation.visibleUntilAfterFrom')
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
                  {post?.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      {t('adminEditor.updated')} {formatDateTime(post.updatedAt)}
                    </Typography>
                  )}
                </Stack>

                <TextField
                  select
                  label={t('adminEditor.fields.type')}
                  value={form.contentTypeId}
                  onChange={(event) => setForm((prev) => ({ ...prev, contentTypeId: event.target.value }))}
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

                <TextField
                  label={`${t('adminEditor.fields.body')} (${activeLocaleUpper})`}
                  value={activeTranslation.body}
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
