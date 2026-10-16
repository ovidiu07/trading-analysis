import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { listExecutions, saveExecution } from '../../api/strategyStudio'
import { listChecklistTemplates } from '../../api/session'
import { ItemActions } from './controls'
import { move, uid, type Checklist, type Studio } from './model'
import { useStudioText } from './labels'
export default function Checklists({
  id,
  templates,
  onChange,
  flush
}: {
  id: string
  templates: Checklist[]
  onChange: (c: Checklist[]) => void
  flush: () => Promise<Studio>
}) {
  const s = useStudioText(),
    [run, setRun] = useState<{ template: Checklist; revision: number; answers: Record<string, boolean> } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const sessionTemplates = useQuery({
    queryKey: ['checklistTemplates', 'studioReuse'],
    queryFn: () => listChecklistTemplates()
  })
  const history = useQuery({ queryKey: ['studioExecutions', id], queryFn: () => listExecutions(id) })
  const patch = (id: string, change: Partial<Checklist>) =>
    onChange(templates.map((c) => (c.id === id ? { ...c, ...change } : c)))
  const completed = run ? Object.values(run.answers).filter(Boolean).length : 0
  const start = async (c: Checklist) => {
    setBusy(true)
    setError('')
    try {
      const saved = await flush()
      const current = saved.definition.checklists.find((x) => x.id === c.id)!
      setRun({ template: structuredClone(current), revision: saved.revision, answers: {} })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const finish = async () => {
    if (!run) return
    setBusy(true)
    setError('')
    try {
      await saveExecution(id, { expectedRevision: run.revision, checklistId: run.template.id, answers: run.answers })
      setRun(null)
      await history.refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {s(
          'Templates define repeatable checks. Each saved execution keeps its original template and strategy configuration.'
        )}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {run ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">{run.template.name}</Typography>
            <Typography>
              {completed} / {run.template.items.length}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={run.template.items.length ? (completed / run.template.items.length) * 100 : 0}
            />
            {run.template.items.map((item) => (
              <FormControlLabel
                key={item.id}
                control={
                  <Checkbox
                    checked={Boolean(run.answers[item.id])}
                    onChange={(_, checked) => setRun({ ...run, answers: { ...run.answers, [item.id]: checked } })}
                  />
                }
                label={`${item.group ? `${item.group} · ` : ''}${item.text}${item.mandatory ? ` · ${s('Mandatory')}` : ''}`}
              />
            ))}
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                disabled={busy || run.template.items.some((i) => i.mandatory && !run.answers[i.id])}
                variant="contained"
                onClick={() => void finish()}
              >
                {s('Save execution')}
              </Button>
              <Button onClick={() => setRun({ ...run, answers: {} })}>{s('Reset')}</Button>
              <Button onClick={() => setRun(null)}>{s('Close')}</Button>
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button
              variant="contained"
              onClick={() =>
                onChange([...templates, { id: uid(), name: 'New checklist', type: 'Pre-trade', items: [] }])
              }
            >
              {s('Add checklist')}
            </Button>
            <TextField
              select
              size="small"
              label={s('Copy session checklist')}
              value=""
              sx={{ minWidth: 210 }}
              onChange={(e) => {
                const original = sessionTemplates.data?.find((t) => t.id === e.target.value)
                if (original)
                  onChange([
                    ...templates,
                    {
                      id: uid(),
                      name: original.name,
                      type: original.type,
                      items: original.items.map((item) => ({
                        id: uid(),
                        text: item.text,
                        mandatory: item.required,
                        group: ''
                      }))
                    }
                  ])
              }}
            >
              <MenuItem value="">{s('Unspecified')}</MenuItem>
              {sessionTemplates.data?.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {!templates.length && <Alert severity="info">{s('No checklist templates yet')}</Alert>}
          {templates.map((c, index) => (
            <Paper key={c.id} variant="outlined" sx={{ p: { xs: 1.25, sm: 2 } }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
                  <Typography variant="h6">{c.name}</Typography>
                  <ItemActions
                    index={index}
                    count={templates.length}
                    onMove={(n) => onChange(move(templates, index, n))}
                    onDuplicate={() =>
                      onChange([
                        ...templates,
                        {
                          ...structuredClone(c),
                          id: uid(),
                          name: `${c.name} (copy)`,
                          items: c.items.map((i) => ({ ...i, id: uid() }))
                        }
                      ])
                    }
                    onDelete={() => onChange(templates.filter((x) => x.id !== c.id))}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label={s('Name')}
                    value={c.name}
                    onChange={(e) => patch(c.id, { name: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={s('Type')}
                    value={c.type}
                    inputProps={{ list: 'studio-checklist-types' }}
                    onChange={(e) => patch(c.id, { type: e.target.value })}
                  />
                  <datalist id="studio-checklist-types">
                    {['Pre-session', 'Pre-trade', 'Entry confirmation', 'Trade management', 'Post-trade review'].map(
                      (t) => (
                        <option key={t} value={t} />
                      )
                    )}
                  </datalist>
                </Stack>
                {c.items.map((item, i) => (
                  <Box key={item.id} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
                    <Stack spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label={s('Item')}
                        value={item.text}
                        onChange={(e) =>
                          patch(c.id, {
                            items: c.items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x))
                          })
                        }
                      />
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                        <TextField
                          size="small"
                          label={s('Group')}
                          value={item.group}
                          onChange={(e) =>
                            patch(c.id, {
                              items: c.items.map((x) => (x.id === item.id ? { ...x, group: e.target.value } : x))
                            })
                          }
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={item.mandatory}
                              onChange={(_, mandatory) =>
                                patch(c.id, { items: c.items.map((x) => (x.id === item.id ? { ...x, mandatory } : x)) })
                              }
                            />
                          }
                          label={s('Mandatory')}
                        />
                        <ItemActions
                          index={i}
                          count={c.items.length}
                          onMove={(n) => patch(c.id, { items: move(c.items, i, n) })}
                          onDelete={() => patch(c.id, { items: c.items.filter((x) => x.id !== item.id) })}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button
                    onClick={() =>
                      patch(c.id, { items: [...c.items, { id: uid(), text: 'New item', mandatory: false, group: '' }] })
                    }
                  >
                    {s('Add item')}
                  </Button>
                  <Button disabled={busy || !c.items.length} onClick={() => void start(c)}>
                    {s('Run checklist')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </>
      )}
      <Typography variant="h6">{s('Execution history')}</Typography>
      {history.isError ? (
        <Alert severity="error" action={<Button onClick={() => void history.refetch()}>{s('Retry')}</Button>}>
          {s('Could not load checklist executions.')}
        </Alert>
      ) : !history.data?.length ? (
        <Typography color="text.secondary">{s('No checklist executions yet')}</Typography>
      ) : (
        history.data.map((e) => (
          <Paper variant="outlined" key={e.id} sx={{ p: 1.5 }}>
            <Typography fontWeight={700}>{e.template.name}</Typography>
            <Typography variant="caption">
              {new Date(e.createdAt).toLocaleString()} · {Object.values(e.answers).filter(Boolean).length} /{' '}
              {e.template.items.length}
            </Typography>
            {e.template.items.map((i) => (
              <Typography key={i.id} variant="body2">
                {e.answers[i.id] ? '☑' : '☐'} {i.text}
                {i.mandatory ? ` · ${s('Mandatory')}` : ''}
              </Typography>
            ))}
          </Paper>
        ))
      )}
    </Stack>
  )
}
