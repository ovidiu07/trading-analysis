import { FormEvent, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AssetListRenderer, { type UploadQueueItem } from '../components/assets/AssetListRenderer'
import AssetUploadDropzone from '../components/assets/AssetUploadDropzone'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import RichTextEditor from '../components/ui/RichTextEditor'
import RichTextContent from '../components/ui/RichTextContent'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import { ApiError } from '../api/client'
import {
  fetchAssetBlob,
  resolveAssetUrl,
  uploadAsset,
  type AssetItem
} from '../api/assets'
import {
  archiveStrategy,
  createStrategy,
  listStrategies,
  removeStrategyAsset,
  setStrategySnapshot,
  updateStrategy,
  type StrategyRequest,
  type StrategyResponse
} from '../api/strategies'
import { MAX_UPLOAD_SIZE_BYTES, ALLOWED_UPLOAD_MIME_TYPES } from '../api/assets'
import { useI18n } from '../i18n'

const parseList = (value: string) => value
  .split(/\r?\n|,/)
  .map((item) => item.trim())
  .filter(Boolean)

const toTextAreaValue = (values?: string[] | null) => (values || []).join('\n')

const toBulletsHtml = (value: string) => {
  const rows = parseList(value)
  if (rows.length === 0) {
    return '<p></p>'
  }
  const escapedRows = rows.map((item) => item
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'))
  return `<ul>${escapedRows.map((item) => `<li>${item}</li>`).join('')}</ul>`
}

const extractEntryLinesFromRich = (html?: string | null) => {
  if (!html) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const liItems = Array.from(doc.querySelectorAll('li'))
    .map((item) => item.textContent?.trim() || '')
    .filter(Boolean)
  if (liItems.length > 0) {
    return liItems
  }
  const paragraphs = Array.from(doc.querySelectorAll('p,h3,h4,blockquote,pre,code'))
    .map((item) => item.textContent?.trim() || '')
    .filter(Boolean)
  return paragraphs
}

type StrategyDraft = {
  name: string
  model: string
  entryConditionsRich: string
  entryPreset: string
  invalidationLogic: string
  tpFramework: string
  noTradeRules: string
  sessionSuitability: string[]
  tags: string
}

const emptyDraft: StrategyDraft = {
  name: '',
  model: '',
  entryConditionsRich: '<p></p>',
  entryPreset: '',
  invalidationLogic: '',
  tpFramework: '',
  noTradeRules: '',
  sessionSuitability: [],
  tags: ''
}

const strategyToDraft = (item: StrategyResponse): StrategyDraft => ({
  name: item.name || '',
  model: item.model || '',
  entryConditionsRich: item.entryConditionsRich || toBulletsHtml(toTextAreaValue(item.entryConditions)),
  entryPreset: toTextAreaValue(item.entryConditions),
  invalidationLogic: item.invalidationLogic || '',
  tpFramework: item.tpFramework || '',
  noTradeRules: item.noTradeRules || '',
  sessionSuitability: item.sessionSuitability || [],
  tags: toTextAreaValue(item.tags)
})

type PreviewModel = {
  name: string
  model: string
  entryConditionsRich: string
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
  snapshotAsset?: AssetItem | null
}

export default function StrategiesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState('')
  const [apiSuccess, setApiSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<StrategyDraft>(emptyDraft)
  const [uploads, setUploads] = useState<UploadQueueItem[]>([])

  const strategiesQuery = useQuery({
    queryKey: ['strategies', true],
    queryFn: () => listStrategies({ includeArchived: true })
  })

  const createMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setEditingId(created.id)
      setDraft(strategyToDraft(created))
      setApiError('')
      setApiSuccess(t('strategies.messages.created'))
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('strategies.messages.createFailed'))
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StrategyRequest }) => updateStrategy(id, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setEditingId(updated.id)
      setDraft(strategyToDraft(updated))
      setApiError('')
      setApiSuccess(t('strategies.messages.updated'))
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('strategies.messages.updateFailed'))
    }
  })

  const archiveMutation = useMutation({
    mutationFn: archiveStrategy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setApiSuccess(t('strategies.messages.archived'))
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('strategies.messages.archiveFailed'))
    }
  })

  const setSnapshotMutation = useMutation({
    mutationFn: ({ strategyId, assetId }: { strategyId: string; assetId: string }) => setStrategySnapshot(strategyId, assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('strategies.messages.snapshotFailed'))
    }
  })

  const removeAssetMutation = useMutation({
    mutationFn: ({ strategyId, assetId }: { strategyId: string; assetId: string }) => removeStrategyAsset(strategyId, assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('strategies.messages.removeAssetFailed'))
    }
  })

  const myStrategies = strategiesQuery.data?.myStrategies || []
  const mentorStrategies = strategiesQuery.data?.mentorStrategies || []
  const editingStrategy = editingId ? myStrategies.find((item) => item.id === editingId) || null : null
  const strategyAssets = editingStrategy?.assets || []

  const previewItem = useMemo<PreviewModel | null>(() => {
    const hasDraftContent = Boolean(
      draft.name.trim() ||
      draft.model.trim() ||
      (draft.entryConditionsRich && draft.entryConditionsRich !== '<p></p>') ||
      draft.invalidationLogic.trim() ||
      draft.tpFramework.trim()
    )
    if (hasDraftContent || editingId) {
      return {
        name: draft.name.trim() || t('strategies.preview.untitled'),
        model: draft.model.trim(),
        entryConditionsRich: draft.entryConditionsRich || '<p></p>',
        invalidationLogic: draft.invalidationLogic,
        tpFramework: draft.tpFramework,
        noTradeRules: draft.noTradeRules,
        sessionSuitability: draft.sessionSuitability,
        tags: parseList(draft.tags),
        snapshotAsset: editingStrategy?.snapshotAsset || null
      }
    }

    const fallback = myStrategies.find((item) => !item.archived) || mentorStrategies[0] || null
    if (!fallback) return null
    return {
      name: fallback.name,
      model: fallback.model,
      entryConditionsRich: fallback.entryConditionsRich || toBulletsHtml(toTextAreaValue(fallback.entryConditions)),
      invalidationLogic: fallback.invalidationLogic,
      tpFramework: fallback.tpFramework,
      noTradeRules: fallback.noTradeRules,
      sessionSuitability: fallback.sessionSuitability || [],
      tags: fallback.tags || [],
      snapshotAsset: fallback.snapshotAsset || null
    }
  }, [draft, editingId, editingStrategy?.snapshotAsset, mentorStrategies, myStrategies, t])

  const fillDraft = (item: StrategyResponse) => {
    setEditingId(item.id)
    setDraft(strategyToDraft(item))
    setApiError('')
    setApiSuccess('')
  }

  const toPayload = (): StrategyRequest => {
    const entryLines = extractEntryLinesFromRich(draft.entryConditionsRich)
    return {
      name: draft.name.trim(),
      model: draft.model.trim(),
      entryConditionsRich: draft.entryConditionsRich,
      entryConditions: entryLines.length > 0 ? entryLines : parseList(draft.entryPreset),
      invalidationLogic: draft.invalidationLogic.trim(),
      tpFramework: draft.tpFramework.trim(),
      noTradeRules: draft.noTradeRules.trim() || undefined,
      sessionSuitability: draft.sessionSuitability,
      tags: parseList(draft.tags),
      snapshotAssetId: editingStrategy?.snapshotAssetId || undefined,
      assetIds: strategyAssets.map((asset) => asset.id),
      archived: false
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')
    setApiSuccess('')
    const payload = toPayload()

    if (!payload.name || !payload.model || !payload.invalidationLogic || !payload.tpFramework) {
      setApiError(t('strategies.messages.required'))
      return
    }

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload })
      return
    }

    await createMutation.mutateAsync(payload)
  }

  const handleUploadFiles = async (files: File[]) => {
    if (!editingId || files.length === 0) {
      setApiError(t('strategies.messages.saveBeforeUpload'))
      return
    }

    const queueItems = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      sizeBytes: file.size,
      progress: 2
    }))
    setUploads((prev) => [...prev, ...queueItems])

    await Promise.all(queueItems.map(async (queueItem, index) => {
      const file = files[index]
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        setUploads((prev) => prev.map((item) => item.id === queueItem.id
          ? { ...item, progress: 0, error: t('assets.errors.tooLarge') }
          : item))
        return
      }
      if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
        setUploads((prev) => prev.map((item) => item.id === queueItem.id
          ? { ...item, progress: 0, error: t('assets.errors.typeNotAllowed') }
          : item))
        return
      }
      try {
        await uploadAsset({
          file,
          scope: 'STRATEGY',
          strategyId: editingId,
          onProgress: (progress) => {
            setUploads((prev) => prev.map((item) => item.id === queueItem.id ? { ...item, progress } : item))
          }
        })
        setUploads((prev) => prev.filter((item) => item.id !== queueItem.id))
        await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      } catch (error) {
        const message = (error as ApiError)?.message || t('strategies.messages.uploadFailed')
        setUploads((prev) => prev.map((item) => item.id === queueItem.id ? { ...item, progress: 0, error: message } : item))
      }
    }))
  }

  const handleSetSnapshot = async (asset: AssetItem) => {
    if (!editingId) {
      setApiError(t('strategies.messages.saveBeforeUpload'))
      return
    }
    await setSnapshotMutation.mutateAsync({ strategyId: editingId, assetId: asset.id })
  }

  const handleRemoveAsset = async (asset: AssetItem) => {
    if (!editingId) {
      setApiError(t('strategies.messages.saveBeforeUpload'))
      return
    }
    await removeAssetMutation.mutateAsync({ strategyId: editingId, assetId: asset.id })
  }

  const handleCopyAssetLink = async (asset: AssetItem) => {
    const raw = asset.url || asset.downloadUrl || asset.viewUrl
    if (!raw) return
    try {
      await navigator.clipboard.writeText(resolveAssetUrl(raw))
      setApiSuccess(t('strategies.messages.linkCopied'))
    } catch {
      setApiError(t('strategies.messages.copyLinkFailed'))
    }
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
      } catch {
        setApiError(t('strategies.messages.downloadFailed'))
      }
      return
    }

    window.open(resolveAssetUrl(downloadUrl), '_blank', 'noopener,noreferrer')
  }

  if (strategiesQuery.isLoading) {
    return <LoadingState rows={10} height={26} />
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Stack spacing={0.5}>
        <Typography variant='h5' sx={{ fontWeight: 700 }}>{t('nav.strategies')}</Typography>
        <Typography variant='body2' color='text.secondary'>
          {t('strategies.subtitle')}
        </Typography>
      </Stack>

      {apiError && <Alert severity='error'>{apiError}</Alert>}
      {apiSuccess && <Alert severity='success' onClose={() => setApiSuccess('')}>{apiSuccess}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant='subtitle1'>{t('strategies.my.title')}</Typography>
                {myStrategies.length === 0 ? (
                  <EmptyState title={t('strategies.my.emptyTitle')} description={t('strategies.my.emptyBody')} />
                ) : (
                  <List disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    {myStrategies.map((item, index) => (
                      <ListItem
                        key={item.id}
                        disableGutters
                        sx={{
                          px: 1.25,
                          py: 1,
                          borderBottom: index < myStrategies.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider'
                        }}
                        secondaryAction={(
                          <Stack direction='row' spacing={1}>
                            <Button size='small' variant='outlined' onClick={() => fillDraft(item)}>{t('common.edit')}</Button>
                            {!item.archived && (
                              <Button size='small' color='error' onClick={() => archiveMutation.mutate(item.id)}>{t('adminContent.actions.archive')}</Button>
                            )}
                          </Stack>
                        )}
                      >
                        <ListItemText
                          primary={item.name}
                          secondary={item.model}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                        {item.archived && <Chip size='small' label={t('adminContent.statuses.archived')} color='default' variant='outlined' />}
                      </ListItem>
                    ))}
                  </List>
                )}

                <Divider />

                <Typography variant='subtitle1'>{editingId ? t('strategies.form.edit') : t('strategies.form.create')}</Typography>
                <Box component='form' onSubmit={submit}>
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('strategies.form.name')}
                        value={draft.name}
                        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                        fullWidth
                        size='small'
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('strategies.form.model')}
                        value={draft.model}
                        onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
                        fullWidth
                        size='small'
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant='body2' sx={{ mb: 0.75 }}>{t('strategies.form.entryConditions')}</Typography>
                      <RichTextEditor
                        value={draft.entryConditionsRich}
                        onChange={(value) => setDraft((prev) => ({ ...prev, entryConditionsRich: value }))}
                        placeholder={t('strategies.form.entryConditionsPlaceholder')}
                        compactToolbar
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Stack spacing={0.75}>
                        <TextField
                          label={t('strategies.form.entryPreset')}
                          value={draft.entryPreset}
                          onChange={(event) => setDraft((prev) => ({ ...prev, entryPreset: event.target.value }))}
                          multiline
                          minRows={2}
                          size='small'
                          helperText={t('strategies.form.entryPresetHint')}
                        />
                        <Button
                          size='small'
                          variant='outlined'
                          sx={{ alignSelf: 'flex-start' }}
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            entryConditionsRich: toBulletsHtml(prev.entryPreset || toTextAreaValue(extractEntryLinesFromRich(prev.entryConditionsRich)))
                          }))}
                        >
                          {t('strategies.form.convertPreset')}
                        </Button>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('strategies.form.invalidation')}
                        value={draft.invalidationLogic}
                        onChange={(event) => setDraft((prev) => ({ ...prev, invalidationLogic: event.target.value }))}
                        fullWidth
                        size='small'
                        multiline
                        minRows={3}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('strategies.form.tpFramework')}
                        value={draft.tpFramework}
                        onChange={(event) => setDraft((prev) => ({ ...prev, tpFramework: event.target.value }))}
                        fullWidth
                        size='small'
                        multiline
                        minRows={3}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('strategies.form.noTradeRules')}
                        value={draft.noTradeRules}
                        onChange={(event) => setDraft((prev) => ({ ...prev, noTradeRules: event.target.value }))}
                        fullWidth
                        size='small'
                        multiline
                        minRows={3}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        SelectProps={{ multiple: true }}
                        label={t('strategies.form.sessionSuitability')}
                        value={draft.sessionSuitability}
                        onChange={(event) => {
                          const value = event.target.value
                          setDraft((prev) => ({
                            ...prev,
                            sessionSuitability: typeof value === 'string' ? value.split(',') : value
                          }))
                        }}
                        fullWidth
                        size='small'
                      >
                        <MenuItem value='Asia'>{t('trades.form.sessions.ASIA')}</MenuItem>
                        <MenuItem value='London'>{t('trades.form.sessions.LONDON')}</MenuItem>
                        <MenuItem value='NY'>{t('trades.form.sessions.NY')}</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label={t('strategies.form.tags')}
                        value={draft.tags}
                        onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                        fullWidth
                        size='small'
                        helperText={t('strategies.form.tagsHint')}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction='row' spacing={1}>
                        <Button
                          type='submit'
                          variant='contained'
                          disabled={createMutation.isLoading || updateMutation.isLoading}
                        >
                          {editingId ? t('common.save') : t('strategies.form.createAction')}
                        </Button>
                        {editingId && (
                          <Button
                            variant='outlined'
                            onClick={() => {
                              setEditingId(null)
                              setDraft(emptyDraft)
                              setUploads([])
                            }}
                          >
                            {t('common.cancel')}
                          </Button>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                <Typography variant='subtitle1'>{t('strategies.assets.title')}</Typography>
                {!editingId ? (
                  <Alert severity='info'>{t('strategies.assets.saveFirst')}</Alert>
                ) : (
                  <Stack spacing={1.25}>
                    <AssetUploadDropzone
                      title={t('strategies.assets.dropTitle')}
                      hint={t('strategies.assets.dropHint')}
                      buttonLabel={t('strategies.assets.selectFiles')}
                      onFilesSelected={handleUploadFiles}
                      multiple
                    />
                    <AssetListRenderer
                      assets={strategyAssets}
                      uploads={uploads}
                      emptyText={t('strategies.assets.empty')}
                      onCopyLink={handleCopyAssetLink}
                      onSetSnapshot={handleSetSnapshot}
                      snapshotAssetId={editingStrategy?.snapshotAssetId}
                      setSnapshotLabel={t('strategies.assets.setSnapshot')}
                      snapshotSelectedLabel={t('strategies.assets.snapshotSelected')}
                      onRemove={handleRemoveAsset}
                      onDownload={handleDownloadAsset}
                      copyLabel={t('adminEditor.assets.copyLink')}
                      removeLabel={t('adminEditor.assets.remove')}
                      downloadLabel={t('adminEditor.assets.download')}
                    />
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <AutoAwesomeMotionRoundedIcon color='primary' fontSize='small' />
                    <Typography variant='subtitle1'>{t('strategies.preview.title')}</Typography>
                  </Stack>
                  {!previewItem ? (
                    <EmptyState title={t('strategies.preview.emptyTitle')} description={t('strategies.preview.emptyBody')} />
                  ) : (
                    <Stack spacing={1}>
                      {previewItem.snapshotAsset?.image && (
                        <SecureAssetImage
                          url={previewItem.snapshotAsset.viewUrl || previewItem.snapshotAsset.url}
                          alt={previewItem.snapshotAsset.originalFileName || previewItem.name}
                          sx={{
                            width: '100%',
                            maxHeight: 220,
                            objectFit: 'cover',
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                          fallback={(
                            <Box
                              sx={{
                                width: '100%',
                                minHeight: 120,
                                borderRadius: 1.5,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.default'
                              }}
                            />
                          )}
                        />
                      )}
                      <Typography variant='h6' sx={{ fontSize: 18 }}>{previewItem.name}</Typography>
                      <Typography variant='body2' color='text.secondary'>{previewItem.model}</Typography>

                      <RichTextContent html={previewItem.entryConditionsRich} />

                      <Typography variant='body2'><strong>{t('strategies.preview.invalidation')}:</strong> {previewItem.invalidationLogic}</Typography>
                      <Typography variant='body2'><strong>{t('strategies.preview.targets')}:</strong> {previewItem.tpFramework}</Typography>
                      {previewItem.noTradeRules && (
                        <Typography variant='body2'><strong>{t('strategies.preview.noTradeRules')}:</strong> {previewItem.noTradeRules}</Typography>
                      )}

                      {previewItem.sessionSuitability.length > 0 && (
                        <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap>
                          {previewItem.sessionSuitability.map((item) => (
                            <Chip key={item} size='small' label={item} variant='outlined' />
                          ))}
                        </Stack>
                      )}
                      {previewItem.tags.length > 0 && (
                        <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap>
                          {previewItem.tags.map((tag) => (
                            <Chip key={tag} size='small' label={tag} />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant='subtitle1'>{t('strategies.mentor.title')}</Typography>
                  {mentorStrategies.length === 0 ? (
                    <EmptyState title={t('strategies.mentor.emptyTitle')} description={t('strategies.mentor.emptyBody')} />
                  ) : (
                    <Stack spacing={1}>
                      {mentorStrategies.slice(0, 8).map((item) => (
                        <Box key={item.id} sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Typography variant='body2' sx={{ fontWeight: 600 }}>{item.name}</Typography>
                          <Typography variant='caption' color='text.secondary'>{item.model}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}
