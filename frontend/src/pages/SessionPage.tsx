import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Checkbox, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { fetchFeaturedDailyPlan, FeaturedPlan } from '../api/today'

const CHECKLIST_IDS = ['plan', 'levels', 'risk', 'windows', 'journal'] as const

type ChecklistId = typeof CHECKLIST_IDS[number]

type ChecklistState = Record<ChecklistId, boolean>

const defaultChecklistState: ChecklistState = {
  plan: false,
  levels: false,
  risk: false,
  windows: false,
  journal: false
}

const toDateKey = (timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const map = parts.reduce<Record<string, string>>((acc, item) => {
    acc[item.type] = item.value
    return acc
  }, {})
  return `${map.year || '0000'}-${map.month || '01'}-${map.day || '01'}`
}

const tradeLogPath = (planId?: string, symbol?: string, strategyTag?: string) => {
  const params = new URLSearchParams()
  params.set('quickLog', '1')
  if (planId) {
    params.set('linkedContentIds', planId)
  }
  if (symbol) {
    params.set('symbol', symbol)
  }
  if (strategyTag) {
    params.set('strategyTag', strategyTag)
  }
  return `/trades?${params.toString()}`
}

export default function SessionPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const timezone = user?.timezone ?? 'Europe/Bucharest'
  const [params] = useSearchParams()

  const checklistStorageKey = `today.checklist.${user?.id || 'anonymous'}.${toDateKey(timezone)}`
  const noteStorageKey = `today.quicknote.${user?.id || 'anonymous'}.${toDateKey(timezone)}`

  const [checklist, setChecklist] = useState<ChecklistState>(defaultChecklistState)
  const [quickNote, setQuickNote] = useState('')

  const checklistItems = useMemo(() => ([
    { id: 'plan' as const, label: t('today.checklist.items.plan') },
    { id: 'levels' as const, label: t('today.checklist.items.levels') },
    { id: 'risk' as const, label: t('today.checklist.items.risk') },
    { id: 'windows' as const, label: t('today.checklist.items.windows') },
    { id: 'journal' as const, label: t('today.checklist.items.journal') }
  ]), [t])

  useEffect(() => {
    const raw = localStorage.getItem(checklistStorageKey)
    if (!raw) {
      setChecklist(defaultChecklistState)
      return
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ChecklistState>
      setChecklist({ ...defaultChecklistState, ...parsed })
    } catch {
      setChecklist(defaultChecklistState)
    }
  }, [checklistStorageKey])

  useEffect(() => {
    localStorage.setItem(checklistStorageKey, JSON.stringify(checklist))
  }, [checklist, checklistStorageKey])

  useEffect(() => {
    setQuickNote(localStorage.getItem(noteStorageKey) || '')
  }, [noteStorageKey])

  useEffect(() => {
    localStorage.setItem(noteStorageKey, quickNote)
  }, [quickNote, noteStorageKey])

  const dailyPlanQuery = useQuery({
    queryKey: ['featuredDailyPlan', timezone],
    queryFn: (): Promise<FeaturedPlan | null> => fetchFeaturedDailyPlan(timezone),
    enabled: Boolean(timezone)
  })

  const selectedPlan = dailyPlanQuery.data && (params.get('plan') === (dailyPlanQuery.data.slug || dailyPlanQuery.data.id) || !params.get('plan'))
    ? dailyPlanQuery.data
    : undefined

  const quickLogTarget = tradeLogPath(
    selectedPlan?.id,
    selectedPlan?.symbols?.[0],
    selectedPlan?.primaryModel
  )

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t('today.session.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('today.session.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} to={quickLogTarget} variant="contained">
            {t('today.actions.logTrade')}
          </Button>
          <Button component={Link} to="/today" variant="outlined">
            {t('today.session.exit')}
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
          gap: 2,
          minWidth: 0
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.session.planSummary')}
              </Typography>
              {dailyPlanQuery.isLoading ? (
                <LoadingState rows={4} height={20} />
              ) : selectedPlan ? (
                <>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedPlan.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedPlan.biasSummary || t('today.cards.daily.noSummary')}
                  </Typography>
                  {selectedPlan.primaryModel && (
                    <Typography variant="body2">
                      <Typography component="span" color="text.secondary">{t('today.cards.daily.primaryModel')}:</Typography>{' '}
                      {selectedPlan.primaryModel}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(selectedPlan.keyLevels || []).slice(0, 6).map((item) => (
                      <Typography key={item} variant="caption" sx={{ px: 1, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </>
              ) : (
                <EmptyState
                  title={t('today.cards.daily.emptyTitle')}
                  description={t('today.cards.daily.emptyBody')}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.checklist.title')}
              </Typography>
              <List disablePadding>
                {checklistItems.map((item) => (
                  <ListItem
                    key={item.id}
                    disableGutters
                    secondaryAction={(
                      <Checkbox
                        edge="end"
                        checked={checklist[item.id]}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setChecklist((prev) => ({ ...prev, [item.id]: checked }))
                        }}
                        inputProps={{ 'aria-label': item.label }}
                      />
                    )}
                  >
                    <ListItemText primary={item.label} />
                  </ListItem>
                ))}
              </List>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t('today.session.quickNote')}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              placeholder={t('today.session.quickNotePlaceholder')}
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
              inputProps={{ 'aria-label': t('today.session.quickNote') }}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
