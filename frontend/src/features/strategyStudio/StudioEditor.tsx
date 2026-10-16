import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, uploadAsset } from '../../api/assets'
import { duplicateStudio, exportStudio, getStudio, getStrategyEvidence, listVersions } from '../../api/strategyStudio'
import type { StrategyResponse } from '../../api/strategies'
import RichTextEditor from '../../components/ui/RichTextEditor'
import LoadingState from '../../components/ui/LoadingState'
import Notebook from './Notebook'
import Parameters from './Parameters'
import Rules from './Rules'
import Checklists from './Checklists'
import Evidence, { Health } from './Evidence'
import VersionHistory, { DifferenceTable } from './VersionHistory'
import { markdown, newBlock, statuses, writeRequest, type Definition, type Portable, type Studio } from './model'
import { useStudioDraft } from './useStudioDraft'
import { useStudioText } from './labels'
export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const tabs = [
  'Overview',
  'Notebook',
  'Parameters',
  'Setup & Rules',
  'Checklists',
  'Backtesting & Evidence',
  'Version History'
]
export default function StudioEditor({
  id,
  onSaved,
  onCreated,
  registerFlush
}: {
  id: string
  onSaved: (s: Studio) => void
  onCreated: (s: Studio) => Promise<void>
  registerFlush: (flush: (() => Promise<Studio>) | null) => void
}) {
  const s = useStudioText(),
    client = useQueryClient(),
    [tab, setTab] = useState(0),
    [menu, setMenu] = useState<HTMLElement | null>(null),
    [actionError, setActionError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [server, setServer] = useState<Studio | null>(null)
  const uploadsInFlight = useRef<Promise<void> | null>(null)
  const uploadFailure = useRef<Error | null>(null)
  const editor = useStudioDraft(id, onSaved),
    { draft, status, error, dirty, edit, flush: saveDraft, accept } = editor
  const flush = useCallback(async () => {
    if (uploadsInFlight.current) await uploadsInFlight.current
    if (uploadFailure.current) throw uploadFailure.current
    return saveDraft()
  }, [saveDraft])
  const statusRef = useRef({ dirty: dirty || uploading, status })
  statusRef.current = { dirty: dirty || uploading, status }
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search) &&
      (statusRef.current.dirty || statusRef.current.status === 'saving')
  )
  useEffect(() => {
    registerFlush(flush)
    return () => registerFlush(null)
  }, [flush, registerFlush])
  useEffect(() => {
    if (blocker.state === 'blocked')
      void flush()
        .then(() => blocker.proceed())
        .catch(() => {})
  }, [blocker, flush])
  useEffect(() => {
    if (!uploading) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [uploading])
  const evidence = useQuery({
    queryKey: ['studioEvidence', id],
    queryFn: () => getStrategyEvidence(id),
    enabled: Boolean(draft)
  })
  const versions = useQuery({
    queryKey: ['studioVersions', id],
    queryFn: () => listVersions(id),
    enabled: Boolean(draft)
  })
  const updateDefinition = (definition: Definition) => edit((value) => ({ ...value, definition }))
  const metadata = (change: Partial<Definition['metadata']>) =>
    edit((value) => ({
      ...value,
      definition: { ...value.definition, metadata: { ...value.definition.metadata, ...change } },
      strategy: { ...value.strategy, archived: change.status ? change.status === 'Archived' : value.strategy.archived }
    }))
  const strategy = (change: Partial<StrategyResponse>) =>
    edit((value) => ({ ...value, strategy: { ...value.strategy, ...change } }))
  const runAction = async (action: () => Promise<void>) => {
    setActionError('')
    setBusy(true)
    setMenu(null)
    try {
      await action()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const exportFile = (format: 'json' | 'md') =>
    runAction(async () => {
      await flush()
      const data = await exportStudio(id)
      download(
        `${data.strategy.name.replace(/[^a-z0-9_-]/gi, '_')}.${format}`,
        format === 'json' ? JSON.stringify(data, null, 2) : markdown(data),
        format === 'json' ? 'application/json' : 'text/markdown'
      )
    })
  const performUpload = async (files: File[], blockId?: string, intoNotebook = true) => {
    setActionError('')
    try {
      for (const file of files) {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type) || file.size > MAX_UPLOAD_SIZE_BYTES)
          throw new Error(s('Use a PNG, JPEG, WebP or GIF image up to 20 MB.'))
        const asset = await uploadAsset({ file, scope: 'STRATEGY', strategyId: id })
        edit((value) => ({
          ...value,
          strategy: { ...value.strategy, assets: [...(value.strategy.assets || []), asset] },
          definition: {
            ...value.definition,
            notebook: intoNotebook
              ? blockId
                ? value.definition.notebook.map((b) => (b.id === blockId ? { ...b, assetId: asset.id } : b))
                : [...value.definition.notebook, { ...newBlock('IMAGE'), assetId: asset.id, caption: file.name }]
              : value.definition.notebook
          }
        }))
      }
    } catch (e) {
      uploadFailure.current = e as Error
      setActionError((e as Error).message)
      throw e
    }
  }
  const uploadImages = (files: File[], blockId?: string, intoNotebook = true) => {
    uploadFailure.current = null
    setUploading(true)
    const task = (uploadsInFlight.current || Promise.resolve())
      .catch(() => {})
      .then(() => performUpload(files, blockId, intoNotebook))
    uploadsInFlight.current = task
    void task
      .finally(() => {
        if (uploadsInFlight.current === task) {
          uploadsInFlight.current = null
          setUploading(false)
        }
      })
      .catch(() => {})
    return task
  }
  if (!draft)
    return status === 'error' ? (
      <Alert severity="error" action={<Button onClick={() => window.location.reload()}>{s('Retry')}</Button>}>
        {error}
      </Alert>
    ) : (
      <LoadingState rows={5} height={90} />
    )
  const d = draft.definition,
    base = draft.strategy,
    assets = base.assets || [],
    saveLabel =
      status === 'saved'
        ? 'Saved'
        : status === 'saving'
          ? 'Saving'
          : status === 'conflict'
            ? 'Editing conflict'
            : status === 'error'
              ? 'Save failed'
              : 'Unsaved changes'
  const richSummary = (key: keyof Definition['summary'], label: string) => (
    <Accordion
      TransitionProps={{ unmountOnExit: true }}
      disableGutters
      elevation={0}
      defaultExpanded={key === 'hypothesis'}
      sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Typography fontWeight={650}>{s(label)}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <RichTextEditor
          allowHighlight
          compactToolbar
          minHeight={180}
          ariaLabel={s(label)}
          value={d.summary[key] || ''}
          onChange={(html) => updateDefinition({ ...d, summary: { ...d.summary, [key]: html } })}
        />
      </AccordionDetails>
    </Accordion>
  )
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }} data-testid="strategy-studio-editor">
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="primary.main">
                {d.metadata.instrument || s('Custom instrument')} · {s(d.metadata.status)}
              </Typography>
              <Typography
                component="h1"
                variant="h4"
                sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem' }, overflowWrap: 'anywhere' }}
              >
                {base.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
                {d.metadata.description || base.model}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ flexShrink: 0 }}>
              <IconButton
                aria-label={s(d.metadata.favorite ? 'Remove favorite' : 'Favorite')}
                onClick={() => metadata({ favorite: !d.metadata.favorite })}
              >
                {d.metadata.favorite ? <StarRounded color="warning" /> : <StarBorderRounded />}
              </IconButton>
              <IconButton aria-label={s('Strategy actions')} onClick={(e) => setMenu(e.currentTarget)}>
                <MoreHorizRounded />
              </IconButton>
            </Stack>
          </Stack>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
            <Chip
              size="small"
              label={s(saveLabel)}
              color={status === 'saved' ? 'success' : ['error', 'conflict'].includes(status) ? 'error' : 'default'}
              variant="outlined"
              aria-live="polite"
            />
            <Typography variant="caption" color="text.secondary">
              {versions.data?.[0]
                ? `${s('Checkpoint')} v${versions.data[0].versionNumber} · ${versions.data[0].name || ''}`
                : s('Draft')}{' '}
              · {s('Last edited')}: {base.updatedAt ? new Date(base.updatedAt).toLocaleString() : s('Unspecified')}
            </Typography>
            <Button
              size="small"
              disabled={busy || status === 'saving' || !dirty || status === 'conflict'}
              onClick={() =>
                void runAction(async () => {
                  await flush()
                })
              }
            >
              {s(status === 'error' ? 'Retry' : 'Save now')}
            </Button>
          </Stack>
          <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
            <MenuItem
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  await flush()
                  await onCreated(await duplicateStudio(id))
                })
              }
            >
              {s('Duplicate')}
            </MenuItem>
            <MenuItem disabled={busy} onClick={() => void exportFile('json')}>
              {s('Export JSON')}
            </MenuItem>
            <MenuItem disabled={busy} onClick={() => void exportFile('md')}>
              {s('Export Markdown')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setTab(0)
                setMenu(null)
              }}
            >
              {s('Settings')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                metadata({ status: d.metadata.status === 'Archived' ? 'Draft' : 'Archived' })
                setMenu(null)
              }}
            >
              {s(d.metadata.status === 'Archived' ? 'Restore from archive' : 'Archive')}
            </MenuItem>
          </Menu>
        </Stack>
      </Paper>
      {(error || actionError) && (
        <Alert
          severity="error"
          onClose={() => {
            setActionError('')
            uploadFailure.current = null
          }}
          action={
            status === 'conflict' ? (
              <Button onClick={() => void runAction(async () => setServer(await getStudio(id)))}>
                {s('Review conflict')}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  void runAction(async () => {
                    await flush()
                  })
                }
              >
                {s('Retry')}
              </Button>
            )
          }
        >
          {actionError || error}
        </Alert>
      )}
      {editor.recovery && (
        <Alert
          severity="warning"
          action={
            <Stack direction="row" flexWrap="wrap">
              <Button onClick={editor.restoreRecovery}>{s('Restore recovery draft')}</Button>
              <Button onClick={editor.dismissRecovery}>{s('Dismiss')}</Button>
            </Stack>
          }
        >
          {s('A browser recovery draft is available. Server content remains the saved source of truth.')}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ minWidth: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label={s('Strategy sections')}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            minWidth: 0,
            '& .MuiTab-root': { minHeight: 56, minWidth: 'auto', px: 2, fontWeight: 650, textTransform: 'none' }
          }}
        >
          {tabs.map((label, i) => (
            <Tab key={label} id={`studio-tab-${i}`} aria-controls={`studio-panel-${i}`} label={s(label)} />
          ))}
        </Tabs>
        <Box
          role="tabpanel"
          id={`studio-panel-${tab}`}
          aria-labelledby={`studio-tab-${tab}`}
          sx={{ p: { xs: 1.25, sm: 2.5 }, minWidth: 0 }}
        >
          {tab === 0 && (
            <Stack spacing={2.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  size="small"
                  label={s('Strategy name')}
                  value={base.name}
                  inputProps={{ maxLength: 120 }}
                  onChange={(e) => strategy({ name: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Strategy type / model')}
                  value={base.model}
                  inputProps={{ maxLength: 255 }}
                  onChange={(e) => strategy({ model: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Primary instrument')}
                  value={d.metadata.instrument || ''}
                  placeholder="DAX / GER40 · NQ · EURUSD"
                  onChange={(e) => metadata({ instrument: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Market')}
                  value={d.metadata.market || ''}
                  onChange={(e) => metadata({ market: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Execution timeframe')}
                  value={d.metadata.executionTimeframe || ''}
                  onChange={(e) => metadata({ executionTimeframe: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Context timeframe')}
                  value={d.metadata.contextTimeframe || ''}
                  onChange={(e) => metadata({ contextTimeframe: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Trading sessions')}
                  value={base.sessionSuitability.join(', ')}
                  helperText={s('Separate sessions with commas')}
                  onChange={(e) => strategy({ sessionSuitability: e.target.value.split(',').map((x) => x.trim()) })}
                />
                <TextField
                  size="small"
                  label={s('Timezone')}
                  value={d.metadata.timezone}
                  helperText="IANA · Europe/Bucharest"
                  onChange={(e) => metadata({ timezone: e.target.value })}
                />
                <TextField
                  size="small"
                  label={s('Direction')}
                  value={d.metadata.direction || ''}
                  inputProps={{ list: 'studio-directions' }}
                  onChange={(e) => metadata({ direction: e.target.value })}
                />
                <datalist id="studio-directions">
                  {['Long', 'Short', 'Both'].map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <TextField
                  size="small"
                  select
                  label={s('Status')}
                  value={d.metadata.status}
                  onChange={(e) => metadata({ status: e.target.value })}
                >
                  {statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {s(status)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label={s('Categories')}
                  value={base.tags.join(', ')}
                  helperText={s('Separate categories with commas')}
                  onChange={(e) => strategy({ tags: e.target.value.split(',').map((x) => x.trim()) })}
                />
              </Box>
              <TextField
                size="small"
                label={s('Description')}
                multiline
                minRows={2}
                value={d.metadata.description || ''}
                onChange={(e) => metadata({ description: e.target.value })}
              />
              <Typography variant="caption" color="text.secondary">
                {s('Created')}: {base.createdAt ? new Date(base.createdAt).toLocaleString() : s('Unspecified')}
              </Typography>
              <Typography variant="h6">{s('Strategy health')}</Typography>
              <Health evidence={evidence.data} error={evidence.isError} retry={() => void evidence.refetch()} />
              <Stack spacing={1}>
                {richSummary('hypothesis', 'Trading hypothesis')}
                {richSummary('context', 'Market context')}
                {richSummary('bias', 'Directional bias')}
                <Accordion
                  TransitionProps={{ unmountOnExit: true }}
                  disableGutters
                  elevation={0}
                  sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    <Typography fontWeight={650}>{s('Entry philosophy')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <RichTextEditor
                      allowHighlight
                      compactToolbar
                      minHeight={180}
                      value={base.entryConditionsRich || ''}
                      ariaLabel={s('Entry philosophy')}
                      onChange={(entryConditionsRich) => strategy({ entryConditionsRich })}
                    />
                  </AccordionDetails>
                </Accordion>
                {(
                  [
                    ['tpFramework', 'Exit philosophy'],
                    ['invalidationLogic', 'Invalidation'],
                    ['noTradeRules', 'Conditions when NOT to trade']
                  ] as const
                ).map(([key, label]) => (
                  <Accordion
                    TransitionProps={{ unmountOnExit: true }}
                    key={key}
                    disableGutters
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                      <Typography fontWeight={650}>{s(label)}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <RichTextEditor
                        allowHighlight
                        compactToolbar
                        minHeight={180}
                        value={base[key] || ''}
                        ariaLabel={s(label)}
                        onChange={(html) => strategy({ [key]: html })}
                      />
                    </AccordionDetails>
                  </Accordion>
                ))}
                {richSummary('risk', 'Risk management')}
                {richSummary('conditions', 'Expected market conditions')}
              </Stack>
            </Stack>
          )}
          {tab === 1 && (
            <Notebook
              blocks={d.notebook}
              onChange={(notebook) => updateDefinition({ ...d, notebook })}
              assets={assets}
              uploading={uploading}
              onUpload={uploadImages}
            />
          )}
          {tab === 2 && <Parameters definition={d} onChange={updateDefinition} />}
          {tab === 3 && (
            <Rules rules={d.rules} parameters={d.parameters} onChange={(rules) => updateDefinition({ ...d, rules })} />
          )}
          {tab === 4 && (
            <Checklists
              id={id}
              templates={d.checklists}
              onChange={(checklists) => updateDefinition({ ...d, checklists })}
              flush={flush}
            />
          )}
          {tab === 5 && (
            <Evidence
              id={id}
              data={evidence.data}
              error={evidence.isError}
              retry={() => void evidence.refetch()}
              notes={d.evidence}
              onChange={(notes) => updateDefinition({ ...d, evidence: notes })}
              assets={assets}
              flush={flush}
              onUpload={(files) => uploadImages(files, undefined, false)}
              uploading={uploading}
            />
          )}
          {tab === 6 && (
            <VersionHistory
              id={id}
              current={draft}
              flush={flush}
              onAccepted={(value) => {
                accept(value)
                void client.invalidateQueries({ queryKey: ['studioVersions', id] })
              }}
            />
          )}
        </Box>
      </Paper>
      <Dialog open={Boolean(server)} onClose={() => setServer(null)} maxWidth="lg" fullWidth>
        <DialogTitle>{s('Review conflict')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {s(
              'Review the server copy against your retained draft. Saving the reviewed draft explicitly replaces these fields using the latest server revision.'
            )}
          </Alert>
          {server && <DifferenceTable before={writeRequest(server)} after={writeRequest(draft)} />}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() =>
              download(
                `${base.name}-recovery.json`,
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    strategy: writeRequest(draft).strategy,
                    definition: draft.definition
                  } satisfies Portable,
                  null,
                  2
                )
              )
            }
          >
            {s('Download recovery JSON')}
          </Button>
          <Button
            onClick={() => {
              accept(server!)
              setServer(null)
            }}
          >
            {s('Keep server copy')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              editor.reviewedRebase(server!)
              setServer(null)
            }}
          >
            {s('Save reviewed draft')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={blocker.state === 'blocked' && (['error', 'conflict'].includes(status) || Boolean(actionError))}>
        <DialogTitle>{s('Unsaved changes')}</DialogTitle>
        <DialogContent>
          {s('Navigation is paused because the strategy could not be saved. Your draft is retained in this tab.')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.state === 'blocked' && blocker.reset()}>{s('Keep editing')}</Button>
          <Button
            onClick={() =>
              void runAction(async () => {
                await flush()
                if (blocker.state === 'blocked') blocker.proceed()
              })
            }
          >
            {s('Retry')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
