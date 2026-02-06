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
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import LoadingState from '../../components/ui/LoadingState'
import MarkdownContent from '../../components/ui/MarkdownContent'
import { ApiError } from '../../api/client'
import {
  ContentPost,
  ContentPostRequest,
  ContentPostStatus,
  ContentPostType,
  archiveContent,
  createContentDraft,
  getContent,
  publishContent,
  updateContent
} from '../../api/content'
import { formatDate, formatDateTime } from '../../utils/format'

const weeklyTemplate = `## Focus\n\n- Primary market theme\n- Risk-on / risk-off cues\n\n## Key Levels\n\n- \n\n## Watchlist\n\n- Ticker — thesis, level, trigger\n\n## If/Then Scenarios\n\n- If ___ then ___\n\n## Invalidation\n\n- Risk limits and what would invalidate the plan\n`

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
  type: ContentPostType
  title: string
  slug: string
  summary: string
  body: string
  tagsInput: string
  symbolsInput: string
  visibleFrom: string
  visibleUntil: string
  weekStart: string
  weekEnd: string
}

const defaultForm: ContentFormState = {
  type: 'STRATEGY',
  title: '',
  slug: '',
  summary: '',
  body: '',
  tagsInput: '',
  symbolsInput: '',
  visibleFrom: '',
  visibleUntil: '',
  weekStart: '',
  weekEnd: ''
}

export default function AdminContentEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isDesktop = useMediaQuery('(min-width:1024px)')
  const [form, setForm] = useState<ContentFormState>(defaultForm)
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
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((data) => {
        setPost(data)
        setStatus(data.status)
        setForm({
          type: data.type,
          title: data.title,
          slug: data.slug || '',
          summary: data.summary || '',
          body: data.body || '',
          tagsInput: joinCsv(data.tags),
          symbolsInput: joinCsv(data.symbols),
          visibleFrom: toInputDateTime(data.visibleFrom),
          visibleUntil: toInputDateTime(data.visibleUntil),
          weekStart: data.weekStart || '',
          weekEnd: data.weekEnd || ''
        })
      })
      .catch((err) => {
        const apiErr = err as ApiError
        setError(apiErr.message || 'Unable to load content')
      })
      .finally(() => setLoading(false))
  }, [id])

  const buildPayload = (): ContentPostRequest => ({
    type: form.type,
    title: form.title.trim(),
    slug: form.slug.trim() ? form.slug.trim() : undefined,
    summary: form.summary.trim() ? form.summary.trim() : undefined,
    body: form.body.trim(),
    tags: parseCsv(form.tagsInput),
    symbols: parseCsv(form.symbolsInput),
    visibleFrom: form.visibleFrom ? new Date(form.visibleFrom).toISOString() : undefined,
    visibleUntil: form.visibleUntil ? new Date(form.visibleUntil).toISOString() : undefined,
    weekStart: form.type === 'WEEKLY_PLAN' ? (form.weekStart || undefined) : undefined,
    weekEnd: form.type === 'WEEKLY_PLAN' ? (form.weekEnd || undefined) : undefined
  })

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) {
      errors.title = 'Title is required'
    }
    if (!form.body.trim()) {
      errors.body = 'Body is required'
    }
    if (form.type === 'WEEKLY_PLAN') {
      if (!form.weekStart) {
        errors.weekStart = 'Week start is required'
      }
      if (!form.weekEnd) {
        errors.weekEnd = 'Week end is required'
      }
      if (form.weekStart && form.weekEnd && form.weekStart > form.weekEnd) {
        errors.weekEnd = 'Week end must be after week start'
      }
    }
    if (form.visibleFrom && form.visibleUntil && form.visibleFrom > form.visibleUntil) {
      errors.visibleUntil = 'Visible until must be after visible from'
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
      setForm((prev) => ({
        ...prev,
        slug: saved.slug || prev.slug
      }))
      if (!post) {
        navigate(`/admin/content/${saved.id}`, { replace: true })
      }
      return saved
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to save content')
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
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to publish content')
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
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Failed to archive content')
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
    return <Chip label={status} color={color} size="small" />
  }, [status])

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LoadingState rows={4} height={32} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title={post ? 'Edit content' : 'Create content'}
        subtitle="Build strategies and weekly plans for the Insights section."
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={saveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button
              variant="contained"
              onClick={() => setConfirmAction('publish')}
              disabled={saving || status === 'PUBLISHED'}
            >
              Publish
            </Button>
            <Button
              variant="text"
              onClick={() => setConfirmAction('archive')}
              disabled={saving || status === 'ARCHIVED' || !post}
            >
              Archive
            </Button>
          </Stack>
        )}
        breadcrumbs={[
          <Button key="admin" size="small" onClick={() => navigate('/admin/content')}>Admin</Button>,
          <Typography key="current" variant="body2">{post ? post.title : 'New content'}</Typography>
        ]}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {statusChip}
                  {post?.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Updated {formatDateTime(post.updatedAt)}
                    </Typography>
                  )}
                </Stack>
                <TextField
                  select
                  label="Type"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ContentPostType }))}
                >
                  <MenuItem value="STRATEGY">Strategy</MenuItem>
                  <MenuItem value="WEEKLY_PLAN">Weekly plan</MenuItem>
                </TextField>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  error={Boolean(fieldErrors.title)}
                  helperText={fieldErrors.title}
                  required
                />
                <TextField
                  label="Slug"
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                  helperText="Optional. If empty, we auto-generate one from the title."
                />
                <TextField
                  label="Summary"
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  multiline
                  minRows={2}
                />
                <TextField
                  label="Body (Markdown)"
                  value={form.body}
                  onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                  multiline
                  minRows={10}
                  error={Boolean(fieldErrors.body)}
                  helperText={fieldErrors.body || 'Use markdown for headings, lists, and emphasis.'}
                  required
                />
                {form.type === 'WEEKLY_PLAN' && (
                  <Button
                    variant="outlined"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      body: prev.body ? `${prev.body}\n\n${weeklyTemplate}` : weeklyTemplate
                    }))}
                  >
                    Insert weekly plan template
                  </Button>
                )}
                <Divider />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Tags"
                      placeholder="comma-separated"
                      value={form.tagsInput}
                      onChange={(event) => setForm((prev) => ({ ...prev, tagsInput: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Symbols"
                      placeholder="comma-separated"
                      value={form.symbolsInput}
                      onChange={(event) => setForm((prev) => ({ ...prev, symbolsInput: event.target.value }))}
                    />
                  </Grid>
                </Grid>
                {form.type === 'WEEKLY_PLAN' && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Week start"
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
                        label="Week end"
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
                      label="Visible from"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={form.visibleFrom}
                      onChange={(event) => setForm((prev) => ({ ...prev, visibleFrom: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Visible until"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={form.visibleUntil}
                      onChange={(event) => setForm((prev) => ({ ...prev, visibleUntil: event.target.value }))}
                      error={Boolean(fieldErrors.visibleUntil)}
                      helperText={fieldErrors.visibleUntil}
                    />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          {!isDesktop && (
            <Button variant="outlined" onClick={() => setShowPreview((prev) => !prev)} sx={{ mb: 2 }}>
              {showPreview ? 'Hide preview' : 'Show preview'}
            </Button>
          )}
          {showPreview && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="text.secondary">Preview</Typography>
                  <Typography variant="h6">{form.title || 'Untitled'}</Typography>
                  {form.summary && (
                    <Typography variant="body2" color="text.secondary">{form.summary}</Typography>
                  )}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={form.type === 'STRATEGY' ? 'Strategy' : 'Weekly plan'} size="small" color="primary" />
                    {parseCsv(form.tagsInput).map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {parseCsv(form.symbolsInput).map((symbol) => (
                      <Chip key={symbol} label={symbol} size="small" variant="outlined" />
                    ))}
                  </Stack>
                  {form.type === 'WEEKLY_PLAN' && form.weekStart && form.weekEnd && (
                    <Typography variant="body2" color="text.secondary">
                      Week of {formatDate(form.weekStart)} – {formatDate(form.weekEnd)}
                    </Typography>
                  )}
                  <MarkdownContent content={form.body} />
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmAction === 'publish' ? 'Publish content' : 'Archive content'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction === 'publish'
              ? 'Publish this content to Insights? All users will see it immediately.'
              : 'Archive this content? It will be hidden from Insights but kept for records.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmAction(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmAction} disabled={saving}>
            {saving ? 'Working…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
