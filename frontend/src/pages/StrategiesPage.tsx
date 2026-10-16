import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
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
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import { listStrategies, type StrategyResponse, type StrategyListResponse } from '../api/strategies'
import { createStudio, importStudio } from '../api/strategyStudio'
import LoadingState from '../components/ui/LoadingState'
import RichTextContent from '../components/ui/RichTextContent'
import StudioEditor from '../features/strategyStudio/StudioEditor'
import { template, type Studio, type Portable } from '../features/strategyStudio/model'
import { useStudioText } from '../features/strategyStudio/labels'

export default function StrategiesPage() {
  const s = useStudioText(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(''),
    [view, setView] = useState('all'),
    [category, setCategory] = useState(''),
    [filterStatus, setFilterStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [mentor, setMentor] = useState<StrategyResponse | null>(null)
  const flushRef = useRef<(() => Promise<Studio>) | null>(null)
  const registerFlush = useCallback((fn: (() => Promise<Studio>) | null) => {
    flushRef.current = fn
  }, [])
  const library = useQuery({ queryKey: ['strategies', true], queryFn: () => listStrategies({ includeArchived: true }) })
  const strategies = useMemo(() => library.data?.myStrategies || [], [library.data]),
    id = params.get('strategy') || ''
  useEffect(() => {
    if (!id && strategies.length) {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('strategy', strategies.find((s) => !s.archived)?.id || strategies[0].id)
          return n
        },
        { replace: true }
      )
    }
  }, [id, strategies, setParams])
  const onSaved = useCallback(
    (value: Studio) => {
      client.setQueryData(['strategies', true], (old: StrategyListResponse) =>
        old
          ? {
              ...old,
              myStrategies: old.myStrategies.some((s) => s.id === value.strategy.id)
                ? old.myStrategies.map((s) => (s.id === value.strategy.id ? value.strategy : s))
                : [value.strategy, ...old.myStrategies]
            }
          : old
      )
      void client.invalidateQueries({ queryKey: ['strategies'], refetchType: 'none' })
    },
    [client]
  )
  const select = async (nextId: string) => {
    setError('')
    try {
      if (flushRef.current) await flushRef.current()
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.set('strategy', nextId)
        return n
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const onCreated = async (value: Studio) => {
    if (flushRef.current) await flushRef.current()
    onSaved(value)
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('strategy', value.strategy.id)
      return n
    })
  }
  const create = async (five: boolean) => {
    setBusy(true)
    setError('')
    try {
      if (flushRef.current) await flushRef.current()
      await onCreated(await createStudio(template(five)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error(s('Import exceeds 4 MB'))
      const data = JSON.parse(await file.text()) as Portable
      if (data.schemaVersion !== 1 || !data.strategy || !data.definition)
        throw new Error(s('Unsupported or malformed strategy export'))
      if (flushRef.current) await flushRef.current()
      await onCreated(await importStudio(data))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const filtered = strategies
    .filter((item) => {
      if (view === 'archive' ? !item.archived : item.archived) return false
      if (view === 'favorites' && !item.studioSummary?.favorite) return false
      if (category && !item.tags.includes(category)) return false
      if (filterStatus && (item.archived ? 'Archived' : item.studioSummary?.status || 'Draft') !== filterStatus)
        return false
      return `${item.name} ${item.model} ${item.studioSummary?.instrument || ''} ${item.tags.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase())
    })
    .sort((a, b) => (view === 'recent' ? (b.updatedAt || '').localeCompare(a.updatedAt || '') : 0))
  const libraryContent = (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" fontWeight={750}>
        {s('All strategies')}{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          {strategies.length}
        </Typography>
      </Typography>
      <Button
        variant="contained"
        fullWidth
        startIcon={<AddRounded />}
        disabled={busy}
        onClick={() => void create(false)}
      >
        {s('Create strategy')}
      </Button>
      <Button variant="outlined" fullWidth disabled={busy} onClick={() => void create(true)}>
        Five Sessions Model
      </Button>
      <TextField
        size="small"
        label={s('Search strategies')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <SearchRounded fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> }}
      />
      <TextField size="small" select label={s('Selection')} value={view} onChange={(e) => setView(e.target.value)}>
        {[
          ['all', 'All strategies'],
          ['favorites', 'Favorites'],
          ['recent', 'Recently edited'],
          ['archive', 'Archive']
        ].map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {s(label)}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" gap={1}>
        <TextField
          size="small"
          select
          fullWidth
          label={s('Categories')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <MenuItem value="">{s('All')}</MenuItem>
          {[...new Set(strategies.flatMap((x) => x.tags))].filter(Boolean).map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          fullWidth
          label={s('Status')}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <MenuItem value="">{s('All')}</MenuItem>
          {['Draft', 'Development', 'Backtesting', 'Validated', 'Live', 'Archived'].map((x) => (
            <MenuItem key={x} value={x}>
              {s(x)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <List
        disablePadding
        aria-label={s('All strategies')}
        sx={{ maxHeight: { xs: 280, md: 'calc(100vh - 490px)' }, overflowY: 'auto', minHeight: 100 }}
      >
        {filtered.map((item) => (
          <ListItemButton
            key={item.id}
            selected={id === item.id}
            onClick={() => void select(item.id)}
            sx={{ alignItems: 'flex-start', px: 1.25, py: 1.5, borderRadius: 1, my: 0.5 }}
          >
            <Box sx={{ minWidth: 0, width: '100%' }}>
              <Stack direction="row" gap={0.5} alignItems="center">
                <Typography fontWeight={650} variant="body2" sx={{ overflowWrap: 'anywhere', flex: 1 }}>
                  {item.name}
                </Typography>
                {item.studioSummary?.favorite && <StarRounded fontSize="small" color="warning" />}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {item.studioSummary?.instrument || item.model}
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={s(item.archived ? 'Archived' : item.studioSummary?.status || 'Draft')}
                />
              </Box>
            </Box>
          </ListItemButton>
        ))}
      </List>
      {!filtered.length && (
        <Typography variant="body2" color="text.secondary">
          {s('No strategies match')}
        </Typography>
      )}
      <Button component="label" disabled={busy}>
        {s('Import JSON')}
        <input
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void importFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </Button>
      {Boolean(library.data?.mentorStrategies.length) && (
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreRounded />}>{s('Mentor strategies')}</AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {library.data?.mentorStrategies.map((item) => (
              <Button
                key={item.id}
                onClick={() => setMentor(item)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                {item.name}
              </Button>
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </Stack>
  )
  return (
    <Stack spacing={2} data-testid="strategies-page" sx={{ minWidth: 0, width: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {s('Strategy Studio')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {s('Define your edge. Document the process. Build the evidence.')}
          </Typography>
        </Box>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {library.isError && (
        <Alert severity="error" action={<Button onClick={() => void library.refetch()}>{s('Retry')}</Button>}>
          {s('Could not load strategies.')}
        </Alert>
      )}
      {library.isLoading ? (
        <LoadingState rows={5} height={90} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: '250px minmax(0,1fr)' },
            gap: 2,
            alignItems: 'start',
            minWidth: 0
          }}
          data-testid="strategies-grid"
        >
          <Paper
            variant="outlined"
            sx={{ p: 1.5, position: { md: 'sticky' }, top: { md: 88 }, display: { xs: 'none', md: 'block' } }}
          >
            {libraryContent}
          </Paper>
          <Accordion sx={{ display: { xs: 'block', md: 'none' }, minWidth: 0 }} defaultExpanded={!id}>
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Typography fontWeight={650}>
                {s('All strategies')} · {strategies.length}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>{libraryContent}</AccordionDetails>
          </Accordion>
          {id ? (
            <StudioEditor key={id} id={id} onSaved={onSaved} onCreated={onCreated} registerFlush={registerFlush} />
          ) : (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6">{s('Choose a strategy to begin')}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                {s('Start blank or use the editable Five Sessions research template.')}
              </Typography>
              <Button variant="contained" disabled={busy} onClick={() => void create(false)}>
                {s('Create strategy')}
              </Button>
            </Paper>
          )}
        </Box>
      )}
      <Dialog open={Boolean(mentor)} onClose={() => setMentor(null)} fullWidth maxWidth="md">
        <DialogTitle>{mentor?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {mentor?.model}
          </Typography>
          <RichTextContent html={mentor?.entryConditionsRich} />
          <Typography sx={{ mt: 2 }}>{mentor?.invalidationLogic}</Typography>
          <Typography>{mentor?.tpFramework}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMentor(null)}>{s('Close')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
