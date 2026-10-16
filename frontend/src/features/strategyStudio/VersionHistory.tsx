import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import {
  createCheckpoint,
  getStudio,
  getVersion,
  listVersions,
  restoreVersion,
  type VersionDetail
} from '../../api/strategyStudio'
import RichTextContent from '../../components/ui/RichTextContent'
import { conditionText, differences, formatValue, type Definition, type Studio } from './model'
import { useStudioText } from './labels'
export function DifferenceTable({ before, after }: { before: unknown; after: unknown }) {
  const s = useStudioText()
  const rows = differences(before, after)
  return !rows.length ? (
    <Typography color="text.secondary">{s('No differences')}</Typography>
  ) : (
    <TableContainer>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell>{s('Changed')}</TableCell>
            <TableCell>{s('Before')}</TableCell>
            <TableCell>{s('After')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((d, i) => (
            <TableRow key={i}>
              <TableCell sx={{ overflowWrap: 'anywhere' }}>
                <Chip
                  size="small"
                  color={d.kind === 'Added' ? 'success' : d.kind === 'Removed' ? 'error' : 'info'}
                  label={s(d.kind)}
                />
                <Typography variant="caption" display="block">
                  {d.path}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                {formatValue(d.before)}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                {formatValue(d.after)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
function SavedDefinition({ snapshot }: { snapshot: Record<string, unknown> }) {
  const s = useStudioText()
  const definition = snapshot.studio as Definition | undefined
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{String(snapshot.name || '')}</Typography>
      <Typography color="text.secondary">{definition?.metadata.description || String(snapshot.model || '')}</Typography>
      {definition && (
        <>
          <Typography fontWeight={700}>{s('Parameters')}</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Name', 'Category', 'Current value', 'Default value', 'Unit'].map((label) => (
                    <TableCell key={label}>{s(label)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {definition.parameters.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{formatValue(p.value)}</TableCell>
                    <TableCell>{formatValue(p.defaultValue)}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography fontWeight={700}>{s('Setup & Rules')}</Typography>
          {definition.rules.map((r) => (
            <Box key={r.id}>
              <Typography fontWeight={650}>{r.name}</Typography>
              <Typography variant="body2">{conditionText(r.condition, definition.parameters)}</Typography>
              <Typography variant="caption">{r.description}</Typography>
            </Box>
          ))}
          <Typography fontWeight={700}>{s('Notebook')}</Typography>
          {definition.notebook.map((b) => (
            <Box key={b.id}>
              <Typography variant="caption" color="text.secondary">
                {b.type}
                {b.caption ? ` · ${b.caption}` : ''}
              </Typography>
              {b.html && <RichTextContent html={b.html} />}{' '}
              {b.rows && (
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {b.rows.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {b.assetId && (
                <Typography variant="caption">
                  {s('Image')}: {b.assetId}
                </Typography>
              )}
            </Box>
          ))}
          <Typography fontWeight={700}>{s('Checklists')}</Typography>
          {definition.checklists.map((c) => (
            <Box key={c.id}>
              <Typography>{c.name}</Typography>
              {c.items.map((i) => (
                <Typography key={i.id} variant="body2">
                  ☐ {i.text}
                  {i.mandatory ? ` · ${s('Mandatory')}` : ''}
                </Typography>
              ))}
            </Box>
          ))}
        </>
      )}
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>{s('Portable snapshot (JSON)')}</AccordionSummary>
        <AccordionDetails>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
            {JSON.stringify(snapshot, null, 2)}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
export function comparableSnapshot(snapshot: Record<string, unknown>) {
  const s = { ...snapshot }
  for (const key of [
    'id',
    'source',
    'slug',
    'assets',
    'snapshotAsset',
    'createdAt',
    'updatedAt',
    'revision',
    'studioSummary',
    'assetIds'
  ])
    delete s[key]
  if ('sessionSuitabilityJson' in s) {
    try {
      s.sessionSuitability = JSON.parse(String(s.sessionSuitabilityJson))
    } catch {}
    delete s.sessionSuitabilityJson
  }
  if ('tagsJson' in s) {
    try {
      s.tags = JSON.parse(String(s.tagsJson))
    } catch {}
    delete s.tagsJson
  }
  if (s.snapshotAssetId == null) delete s.snapshotAssetId
  delete s.entryConditionsJson
  delete s.entryConditions
  return s
}
export default function VersionHistory({
  id,
  current,
  flush,
  onAccepted
}: {
  id: string
  current: Studio
  flush: () => Promise<Studio>
  onAccepted: (s: Studio) => void
}) {
  const s = useStudioText(),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<VersionDetail | null>(null),
    [other, setOther] = useState<VersionDetail | null>(null),
    [otherId, setOtherId] = useState('')
  const history = useQuery({ queryKey: ['studioVersions', id], queryFn: () => listVersions(id) })
  const action = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const checkpoint = () =>
    action(async () => {
      const saved = await flush()
      await createCheckpoint(id, { expectedRevision: saved.revision, name, description })
      onAccepted(await getStudio(id))
      setName('')
      setDescription('')
      await history.refetch()
    })
  const restore = () =>
    action(async () => {
      if (!selected) return
      const saved = await flush()
      onAccepted(await restoreVersion(id, selected.version.id, saved.revision))
      await history.refetch()
    })
  const currentSnapshot = comparableSnapshot({ ...current.strategy, studio: current.definition })
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {s(
          'Checkpoints preserve metadata, notebook, parameters, presets, rules and checklists. Restoring creates a new checkpoint; historical trades keep their associations.'
        )}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label={s('Version name')}
            value={name}
            inputProps={{ maxLength: 120 }}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            size="small"
            label={s('Change description')}
            multiline
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Box>
            <Button variant="contained" disabled={busy || !name.trim()} onClick={() => void checkpoint()}>
              {s('Create checkpoint')}
            </Button>
          </Box>
        </Stack>
      </Paper>
      {history.isError ? (
        <Alert severity="error" action={<Button onClick={() => void history.refetch()}>{s('Retry')}</Button>}>
          {s('Could not load version history.')}
        </Alert>
      ) : !history.data?.length ? (
        <Typography>{s('No versions yet')}</Typography>
      ) : (
        history.data.map((v) => (
          <Paper key={v.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
              <Box>
                <Typography fontWeight={700}>
                  v{v.versionNumber} · {v.name || s('Checkpoint')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {v.changeDescription}
                </Typography>
                <Typography variant="caption">{v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}</Typography>
              </Box>
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    setSelected(await getVersion(id, v.id))
                    setOther(null)
                    setOtherId('')
                  })
                }
              >
                {s('Inspect')}
              </Button>
            </Stack>
          </Paper>
        ))
      )}
      {selected && (
        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">
              v{selected.version.versionNumber} · {selected.version.name}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <TextField
                select
                fullWidth
                size="small"
                label={s('Compare')}
                value={otherId}
                onChange={(e) => {
                  setOtherId(e.target.value)
                  if (!e.target.value) {
                    setOther(null)
                    return
                  }
                  void action(async () => setOther(await getVersion(id, e.target.value)))
                }}
              >
                <MenuItem value="">{s('Compared with current draft')}</MenuItem>
                {history.data
                  ?.filter((v) => v.id !== selected.version.id)
                  .map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      v{v.versionNumber} · {v.name}
                    </MenuItem>
                  ))}
              </TextField>
              <Button disabled={busy} onClick={() => void restore()}>
                {s('Restore as new checkpoint')}
              </Button>
            </Stack>
            <DifferenceTable
              before={comparableSnapshot(selected.snapshot)}
              after={other ? comparableSnapshot(other.snapshot) : currentSnapshot}
            />
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>{s('Inspect saved definition')}</AccordionSummary>
              <AccordionDetails>
                <SavedDefinition snapshot={selected.snapshot} />
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
