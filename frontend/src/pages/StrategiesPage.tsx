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
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  archiveStrategy,
  createStrategy,
  listStrategies,
  updateStrategy,
  type StrategyRequest,
  type StrategyResponse
} from '../api/strategies'

const parseList = (value: string) => value
  .split(/\r?\n|,/)
  .map((item) => item.trim())
  .filter(Boolean)

const toTextAreaValue = (values?: string[] | null) => (values || []).join('\n')

type StrategyDraft = {
  name: string
  model: string
  entryConditions: string
  invalidationLogic: string
  tpFramework: string
  noTradeRules: string
  sessionSuitability: string[]
  tags: string
}

const emptyDraft: StrategyDraft = {
  name: '',
  model: '',
  entryConditions: '',
  invalidationLogic: '',
  tpFramework: '',
  noTradeRules: '',
  sessionSuitability: [],
  tags: ''
}

export default function StrategiesPage() {
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<StrategyDraft>(emptyDraft)

  const strategiesQuery = useQuery({
    queryKey: ['strategies', true],
    queryFn: () => listStrategies({ includeArchived: true })
  })

  const createMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setDraft(emptyDraft)
      setEditingId(null)
      setApiError('')
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Could not create strategy')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StrategyRequest }) => updateStrategy(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setDraft(emptyDraft)
      setEditingId(null)
      setApiError('')
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Could not update strategy')
    }
  })

  const archiveMutation = useMutation({
    mutationFn: archiveStrategy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Could not archive strategy')
    }
  })

  const myStrategies = strategiesQuery.data?.myStrategies || []
  const mentorStrategies = strategiesQuery.data?.mentorStrategies || []

  const previewItem = useMemo(() => {
    if (editingId) {
      return myStrategies.find((item) => item.id === editingId) || null
    }
    return myStrategies.find((item) => !item.archived) || mentorStrategies[0] || null
  }, [editingId, mentorStrategies, myStrategies])

  const fillDraft = (item: StrategyResponse) => {
    setEditingId(item.id)
    setDraft({
      name: item.name || '',
      model: item.model || '',
      entryConditions: toTextAreaValue(item.entryConditions),
      invalidationLogic: item.invalidationLogic || '',
      tpFramework: item.tpFramework || '',
      noTradeRules: item.noTradeRules || '',
      sessionSuitability: item.sessionSuitability || [],
      tags: toTextAreaValue(item.tags)
    })
  }

  const toPayload = (): StrategyRequest => ({
    name: draft.name.trim(),
    model: draft.model.trim(),
    entryConditions: parseList(draft.entryConditions),
    invalidationLogic: draft.invalidationLogic.trim(),
    tpFramework: draft.tpFramework.trim(),
    noTradeRules: draft.noTradeRules.trim() || undefined,
    sessionSuitability: draft.sessionSuitability,
    tags: parseList(draft.tags),
    archived: false
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')
    const payload = toPayload()

    if (!payload.name || !payload.model || !payload.invalidationLogic || !payload.tpFramework) {
      setApiError('Name, model, invalidation logic, and TP framework are required.')
      return
    }

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload })
      return
    }

    await createMutation.mutateAsync(payload)
  }

  if (strategiesQuery.isLoading) {
    return <LoadingState rows={10} height={26} />
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Stack spacing={0.5}>
        <Typography variant='h5' sx={{ fontWeight: 700 }}>Strategies</Typography>
        <Typography variant='body2' color='text.secondary'>
          Build structured playbooks for execution and analytics. Mentor strategies are read-only.
        </Typography>
      </Stack>

      {apiError && <Alert severity='error'>{apiError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant='subtitle1'>My strategies</Typography>
                {myStrategies.length === 0 ? (
                  <EmptyState title='No strategies yet' description='Create your first strategy below.' />
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
                            <Button size='small' variant='outlined' onClick={() => fillDraft(item)}>Edit</Button>
                            {!item.archived && (
                              <Button size='small' color='error' onClick={() => archiveMutation.mutate(item.id)}>Archive</Button>
                            )}
                          </Stack>
                        )}
                      >
                        <ListItemText
                          primary={item.name}
                          secondary={item.model}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                        {item.archived && <Chip size='small' label='Archived' color='default' variant='outlined' />}
                      </ListItem>
                    ))}
                  </List>
                )}

                <Divider />

                <Typography variant='subtitle1'>{editingId ? 'Edit strategy' : 'Create strategy'}</Typography>
                <Box component='form' onSubmit={submit}>
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label='Name'
                        value={draft.name}
                        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                        fullWidth
                        size='small'
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label='Model'
                        value={draft.model}
                        onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
                        fullWidth
                        size='small'
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label='Entry conditions'
                        value={draft.entryConditions}
                        onChange={(event) => setDraft((prev) => ({ ...prev, entryConditions: event.target.value }))}
                        fullWidth
                        size='small'
                        multiline
                        minRows={3}
                        helperText='One item per line'
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label='Invalidation / SL logic'
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
                        label='TP framework'
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
                        label='No-trade rules'
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
                        label='Session suitability'
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
                        <MenuItem value='Asia'>Asia</MenuItem>
                        <MenuItem value='London'>London</MenuItem>
                        <MenuItem value='NY'>NY</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label='Tags'
                        value={draft.tags}
                        onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                        fullWidth
                        size='small'
                        helperText='Comma or newline separated'
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction='row' spacing={1}>
                        <Button
                          type='submit'
                          variant='contained'
                          disabled={createMutation.isLoading || updateMutation.isLoading}
                        >
                          {editingId ? 'Update strategy' : 'Create strategy'}
                        </Button>
                        {editingId && (
                          <Button
                            variant='outlined'
                            onClick={() => {
                              setEditingId(null)
                              setDraft(emptyDraft)
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </Box>
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
                    <Typography variant='subtitle1'>Preview</Typography>
                  </Stack>
                  {!previewItem ? (
                    <EmptyState title='No strategy selected' description='Select or create a strategy to preview it.' />
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant='h6' sx={{ fontSize: 18 }}>{previewItem.name}</Typography>
                      <Typography variant='body2' color='text.secondary'>{previewItem.model}</Typography>
                      {(previewItem.entryConditions || []).length > 0 && (
                        <List dense disablePadding>
                          {(previewItem.entryConditions || []).map((item) => (
                            <ListItem key={item} disableGutters sx={{ py: 0.15 }}>
                              <ListItemText primary={`• ${item}`} />
                            </ListItem>
                          ))}
                        </List>
                      )}
                      <Typography variant='body2'><strong>Invalidation:</strong> {previewItem.invalidationLogic}</Typography>
                      <Typography variant='body2'><strong>Targets:</strong> {previewItem.tpFramework}</Typography>
                      {previewItem.noTradeRules && (
                        <Typography variant='body2'><strong>No-trade rules:</strong> {previewItem.noTradeRules}</Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant='subtitle1'>Mentor strategies</Typography>
                  {mentorStrategies.length === 0 ? (
                    <EmptyState title='No mentor strategies' description='Publish STRATEGY content in Admin.' />
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
