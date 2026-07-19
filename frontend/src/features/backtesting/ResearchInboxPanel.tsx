import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import InboxRoundedIcon from '@mui/icons-material/InboxRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { useMutation } from '@tanstack/react-query'
import {
  BacktestingClassificationStatus,
  BacktestingCompatibilityCheck,
  BacktestingEvidence,
  BacktestingResearchInbox,
  BacktestingWorkspaceCompatibility,
  excludeBacktestingEvidence,
  includeBacktestingEvidence,
  linkBacktestingEvidence,
  retryBacktestingEvidence,
  updateBacktestingEvidence
} from '../../api/backtesting'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import { useI18n } from '../../i18n'

type Props = {
  inbox?: BacktestingResearchInbox
  loading: boolean
  onChanged: (message: string) => Promise<void>
  onError: (caught: unknown) => void
}

export default function ResearchInboxPanel({ inbox, loading, onChanged, onError }: Props) {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [includeItem, setIncludeItem] = useState<BacktestingEvidence | null>(null)
  const [reasonItem, setReasonItem] = useState<BacktestingEvidence | null>(null)
  const [pickerItem, setPickerItem] = useState<BacktestingEvidence | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [showIncompatible, setShowIncompatible] = useState(false)
  const [expandedCompatibility, setExpandedCompatibility] = useState<Record<string, boolean>>({})
  const [classificationItem, setClassificationItem] = useState<BacktestingEvidence | null>(null)
  const [classificationStatus, setClassificationStatus] = useState<BacktestingClassificationStatus>('PARTIAL')
  const [classificationDraft, setClassificationDraft] = useState<Record<string, string>>({})

  const includeMutation = useMutation({
    mutationFn: includeBacktestingEvidence,
    onSuccess: async (updated) => {
      setIncludeItem(null)
      await onChanged(t('backtesting.feedback.evidenceIncluded'))
      if (updated.workspaceLinkStatus !== 'LINKED' && updated.workspaceOptions?.length) openPicker(updated)
    },
    onError
  })
  const excludeMutation = useMutation({
    mutationFn: excludeBacktestingEvidence,
    onSuccess: () => onChanged(t('backtesting.feedback.evidenceExcluded')),
    onError
  })
  const linkMutation = useMutation({
    mutationFn: ({ evidenceId, workspaceId }: { evidenceId: string; workspaceId: string }) => linkBacktestingEvidence(evidenceId, workspaceId),
    onSuccess: async () => {
      setPickerItem(null)
      resetPicker()
      await onChanged(t('backtesting.feedback.evidenceLinked'))
    },
    onError
  })
  const retryMutation = useMutation({
    mutationFn: retryBacktestingEvidence,
    onSuccess: () => onChanged(t('backtesting.feedback.syncRetried')),
    onError
  })
  const classificationMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateBacktestingEvidence>[1] }) => updateBacktestingEvidence(id, payload),
    onSuccess: async () => {
      setClassificationItem(null)
      await onChanged(t('backtesting.feedback.evidenceUpdated'))
    },
    onError
  })

  const classificationFields = ['marketRegime', 'htfBiasQuality', 'liquidityType', 'sweepType', 'displacementQuality', 'mssQuality', 'gapType', 'gapFillStatus', 'entryModel', 'researchTags']

  function openClassification(item: BacktestingEvidence) {
    setClassificationItem(item)
    setClassificationStatus(item.classificationStatus === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL')
    setClassificationDraft(Object.fromEntries(Object.entries(item.researchClassification || {}).map(([key, value]) => [key, String(value ?? '')])))
  }

  function openPicker(item: BacktestingEvidence) {
    setPickerItem(item)
    setSelectedWorkspaceId(item.workspaceId || '')
    setWorkspaceSearch('')
    setShowIncompatible(false)
  }

  function resetPicker() {
    setSelectedWorkspaceId('')
    setWorkspaceSearch('')
    setShowIncompatible(false)
  }

  const pickerOptions = useMemo(() => {
    const options = pickerItem?.workspaceOptions || []
    return options
      .filter((option) => showIncompatible || option.compatible)
      .filter((option) => `${option.workspaceName} ${option.strategyName || ''} ${option.instrument} ${option.session || ''} ${option.timeframe || ''}`.toLowerCase().includes(workspaceSearch.trim().toLowerCase()))
      .sort((left, right) => Number(right.compatible) - Number(left.compatible) || left.workspaceName.localeCompare(right.workspaceName))
  }, [pickerItem, showIncompatible, workspaceSearch])
  const selectedOption = pickerItem?.workspaceOptions?.find((option) => option.workspaceId === selectedWorkspaceId)
  const compatibleCount = pickerItem?.workspaceOptions?.filter((option) => option.compatible).length || 0

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, width: '100%', minWidth: 0 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>
            <InboxRoundedIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.75 }} />
            {t('backtesting.inbox.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">{t('backtesting.inbox.description')}</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {[
            ['needsWorkspace', inbox?.needsWorkspace || 0],
            ['needsClassification', inbox?.needsClassification || 0],
            ['ambiguousMatch', inbox?.ambiguousMatch || 0],
            ['syncErrors', inbox?.syncErrors || 0],
            ['excluded', inbox?.excluded || 0]
          ].map(([key, value]) => <Chip key={key} size="small" variant="outlined" label={`${t(`backtesting.inbox.${key}`)} · ${value}`} />)}
        </Stack>
      </Stack>

      {loading ? <LoadingState rows={2} height={112} /> : !inbox?.items.length ? (
        <EmptyState title={t('backtesting.empty.inboxTitle')} description={t('backtesting.empty.inboxBody')} />
      ) : (
        <Stack spacing={1}>
          {inbox.items.map((item) => {
            const inclusionStatus = item.researchInclusionStatus || (item.syncStatus === 'EXCLUDED' ? 'EXCLUDED' : 'INCLUDED')
            const linkStatus = item.workspaceLinkStatus || fallbackLinkStatus(item)
            const excluded = inclusionStatus === 'EXCLUDED'
            const bestOption = item.workspaceOptions?.[0]
            const detailsOpen = Boolean(expandedCompatibility[item.id])
            return (
              <Paper key={item.id} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>
                        {item.instrument || t('backtesting.common.unknown')} · {item.direction ? t(`backtesting.direction.${item.direction}`) : t('backtesting.common.unknown')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(item.tradeDate, locale)} · {item.session || t('backtesting.workspace.anySession')} · {item.timeframe || t('backtesting.workspace.anyTimeframe')} · {formatR(item.realizedR, locale)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                        {item.strategyName || t('backtesting.workspace.unlinkedStrategy')} · {item.result ? t(`backtesting.results.${item.result}`) : t('backtesting.common.unknown')}
                      </Typography>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }} aria-label={t('backtesting.accessibility.evidenceStatuses')}>
                        <Chip size="small" variant="outlined" color={excluded ? 'warning' : 'success'} label={t(`backtesting.inclusionStatus.${inclusionStatus}`)} />
                        <Chip size="small" variant="outlined" color={linkStatus === 'LINKED' ? 'success' : linkStatus === 'ERROR' ? 'error' : 'default'} label={t(`backtesting.workspaceLinkStatus.${linkStatus}`)} />
                        <Chip size="small" variant="outlined" color={item.classificationStatus === 'COMPLETE' ? 'success' : 'warning'} label={t(`backtesting.classificationStatus.${item.classificationStatus}`)} />
                        <Chip size="small" color="success" label={t('backtesting.sources.LIVE')} />
                      </Stack>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} useFlexGap flexWrap="wrap" sx={{ width: { xs: '100%', md: 'auto' }, maxWidth: { md: 650 } }}>
                      {excluded ? (
                        <>
                          <Button fullWidth={mobile} variant="contained" onClick={() => setIncludeItem(item)}>{t('backtesting.actions.includeInResearch')}</Button>
                          <Button fullWidth={mobile} variant="outlined" startIcon={<OpenInNewRoundedIcon />} href={`/trades?tradeId=${item.liveTradeId}`}>{t('backtesting.actions.openLiveTrade')}</Button>
                          {item.excludedReason && <Button fullWidth={mobile} onClick={() => setReasonItem(item)}>{t('backtesting.actions.viewExclusionReason')}</Button>}
                        </>
                      ) : (
                        <>
                          {linkStatus !== 'LINKED' && <Button fullWidth={mobile} variant="contained" onClick={() => openPicker(item)}>{linkStatus === 'AMBIGUOUS' ? t('backtesting.actions.chooseWorkspace') : t('backtesting.actions.linkToWorkspace')}</Button>}
                          {linkStatus === 'LINKED' && item.workspaceId && <Button fullWidth={mobile} variant="outlined" href={`/backtesting/${item.workspaceId}`}>{t('backtesting.actions.viewWorkspace')}</Button>}
                          {item.classificationStatus !== 'COMPLETE' && <Button fullWidth={mobile} variant="outlined" startIcon={<CheckCircleOutlineRoundedIcon />} onClick={() => openClassification(item)}>{t('backtesting.actions.classify')}</Button>}
                          {item.syncStatus === 'ERROR' && <Button fullWidth={mobile} variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={() => retryMutation.mutate(item.id)}>{t('backtesting.actions.retrySync')}</Button>}
                          <Button fullWidth={mobile} color="warning" onClick={() => excludeMutation.mutate(item.id)}>{t('backtesting.actions.exclude')}</Button>
                          <Button fullWidth={mobile} startIcon={<OpenInNewRoundedIcon />} href={`/trades?tradeId=${item.liveTradeId}`}>{t('backtesting.actions.openLiveTrade')}</Button>
                        </>
                      )}
                    </Stack>
                  </Stack>

                  {bestOption && (
                    <Box>
                      <Button
                        size="small"
                        startIcon={<ExpandMoreRoundedIcon sx={{ transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />}
                        aria-expanded={detailsOpen}
                        aria-controls={`compatibility-${item.id}`}
                        onClick={() => setExpandedCompatibility((current) => ({ ...current, [item.id]: !detailsOpen }))}
                      >
                        {t('backtesting.compatibility.title')}
                      </Button>
                      <Collapse in={detailsOpen} id={`compatibility-${item.id}`}>
                        <CompatibilitySummary item={item} option={bestOption} />
                      </Collapse>
                    </Box>
                  )}
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}

      <Dialog open={Boolean(includeItem)} onClose={() => !includeMutation.isLoading && setIncludeItem(null)} fullWidth maxWidth="sm" aria-labelledby="include-evidence-title">
        <DialogTitle id="include-evidence-title">{t('backtesting.dialogs.includeEvidenceTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography>{t('backtesting.dialogs.includeEvidenceBody')}</Typography>
            {includeItem?.excludedReason && <Alert severity="info"><strong>{t('backtesting.inbox.exclusionReason')}:</strong> {reasonText(includeItem.excludedReason, t)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIncludeItem(null)} disabled={includeMutation.isLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={includeMutation.isLoading} onClick={() => includeItem && includeMutation.mutate(includeItem.id)}>{t('backtesting.actions.includeInResearch')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reasonItem)} onClose={() => setReasonItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('backtesting.inbox.exclusionReason')}</DialogTitle>
        <DialogContent><Alert severity="info">{reasonItem?.excludedReason ? reasonText(reasonItem.excludedReason, t) : t('backtesting.common.unknown')}</Alert></DialogContent>
        <DialogActions><Button onClick={() => setReasonItem(null)}>{t('common.close')}</Button></DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(pickerItem)}
        onClose={() => { setPickerItem(null); resetPicker() }}
        fullScreen={mobile}
        fullWidth
        maxWidth="md"
        aria-labelledby="workspace-picker-title"
        PaperProps={{ sx: { maxHeight: mobile ? '100%' : 'min(90vh, 900px)' } }}
      >
        <DialogTitle id="workspace-picker-title">{t('backtesting.dialogs.chooseWorkspace')}</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{pickerItem?.instrument} · {pickerItem?.strategyName || t('backtesting.workspace.unlinkedStrategy')} · {pickerItem?.session || t('backtesting.workspace.anySession')} · {pickerItem?.timeframe || t('backtesting.workspace.anyTimeframe')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('backtesting.compatibility.pickerHelp')}</Typography>
            </Box>
            <TextField fullWidth label={t('backtesting.compatibility.searchWorkspaces')} value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} />
            <FormControlLabel control={<Checkbox checked={showIncompatible} onChange={(event) => setShowIncompatible(event.target.checked)} />} label={t('backtesting.actions.showIncompatibleWorkspaces')} />
            {!compatibleCount && (
              <Alert severity="warning" action={pickerItem && pickerItem.workspaceOptions?.some((option) => option.checks.some((check) => check.code === 'STRATEGY_MISMATCH')) ? <Button color="inherit" size="small" href={`/trades?tradeId=${pickerItem.liveTradeId}`}>{t('backtesting.actions.assignTradeStrategy')}</Button> : undefined}>
                {t('backtesting.compatibility.noCompatibleWorkspace')}
              </Alert>
            )}
            {!pickerOptions.length ? <Alert severity="info">{t('backtesting.compatibility.noVisibleWorkspace')}</Alert> : (
              <RadioGroup value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value)} aria-label={t('backtesting.accessibility.workspaceOptions')}>
                <Stack spacing={1}>
                  {pickerOptions.map((option) => {
                    const aliasCheck = option.checks.find((check) => check.code === 'INSTRUMENT_ALIAS_MATCH')
                    const optionExpanded = Boolean(expandedCompatibility[`picker-${option.workspaceId}`])
                    return (
                      <Paper key={option.workspaceId} variant="outlined" sx={{ p: 1.25, borderColor: selectedWorkspaceId === option.workspaceId ? 'primary.main' : undefined, opacity: option.selectable ? 1 : 0.78 }}>
                        <FormControlLabel
                          value={option.workspaceId}
                          disabled={!option.selectable}
                          control={<Radio />}
                          sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                          label={(
                            <Box sx={{ minWidth: 0, pt: 0.25 }}>
                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{option.workspaceName}</Typography>
                                <Chip size="small" color={option.compatible ? 'success' : 'default'} label={option.compatible ? t('backtesting.compatibility.compatibleWorkspace') : t('backtesting.compatibility.incompatibleWorkspace')} />
                              </Stack>
                              <Typography variant="body2" color="text.secondary">{option.strategyName || t('backtesting.workspace.unlinkedStrategy')} · {option.instrument} · {option.session || t('backtesting.workspace.anySession')} · {option.timeframe || t('backtesting.workspace.anyTimeframe')}</Typography>
                              {aliasCheck && <Typography variant="body2" color="success.main">{t('backtesting.compatibility.aliasSummary', { trade: aliasCheck.tradeValue || '', workspace: aliasCheck.workspaceValue || '' })}</Typography>}
                            </Box>
                          )}
                        />
                        <Button size="small" startIcon={<ExpandMoreRoundedIcon sx={{ transform: optionExpanded ? 'rotate(180deg)' : 'none' }} />} aria-expanded={optionExpanded} aria-controls={`workspace-compatibility-${option.workspaceId}`} onClick={() => setExpandedCompatibility((current) => ({ ...current, [`picker-${option.workspaceId}`]: !optionExpanded }))}>{t('backtesting.compatibility.title')}</Button>
                        <Collapse in={optionExpanded} id={`workspace-compatibility-${option.workspaceId}`}>
                          <CompatibilityChecklist checks={option.checks} />
                        </Collapse>
                      </Paper>
                    )
                  })}
                </Stack>
              </RadioGroup>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <Button onClick={() => { setPickerItem(null); resetPicker() }} disabled={linkMutation.isLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={!selectedOption?.selectable || linkMutation.isLoading} onClick={() => pickerItem && selectedWorkspaceId && linkMutation.mutate({ evidenceId: pickerItem.id, workspaceId: selectedWorkspaceId })}>{t('backtesting.actions.linkToWorkspace')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(classificationItem)} onClose={() => setClassificationItem(null)} fullScreen={mobile} fullWidth maxWidth="md">
        <DialogTitle>{t('backtesting.dialogs.classifyEvidence')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">{t('backtesting.inbox.classificationHelp')}</Alert>
            <TextField select fullWidth size="small" label={t('backtesting.filters.classificationStatus')} value={classificationStatus} onChange={(event) => setClassificationStatus(event.target.value as BacktestingClassificationStatus)}>
              {(['PARTIAL', 'COMPLETE'] as const).map((value) => <MenuItem key={value} value={value}>{t(`backtesting.classificationStatus.${value}`)}</MenuItem>)}
            </TextField>
            <Grid container spacing={1.25}>
              {classificationFields.map((key) => <Grid key={key} item xs={12} sm={6}><TextField fullWidth size="small" label={t(`backtesting.classification.${key}`)} value={classificationDraft[key] || ''} onChange={(event) => setClassificationDraft((current) => ({ ...current, [key]: event.target.value }))} /></Grid>)}
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <Button onClick={() => setClassificationItem(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={classificationMutation.isLoading} onClick={() => classificationItem && classificationMutation.mutate({ id: classificationItem.id, payload: { classificationStatus, researchClassification: Object.fromEntries(Object.entries(classificationDraft).filter(([, value]) => value.trim())) } })}>{t('backtesting.actions.saveClassification')}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

function CompatibilitySummary({ item, option }: { item: BacktestingEvidence; option: BacktestingWorkspaceCompatibility }) {
  const { t } = useI18n()
  return (
    <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5 }}>
      {!option.compatible && <Alert severity="warning" sx={{ mb: 1 }}>{t('backtesting.compatibility.cannotLinkYet')}</Alert>}
      <Typography variant="body2" sx={{ fontWeight: 800 }}>{t('backtesting.compatibility.tradeLabel')}</Typography>
      <Typography variant="body2" color="text.secondary">{item.instrument} · {item.strategyName || t('backtesting.workspace.unlinkedStrategy')} · {item.session || t('backtesting.workspace.anySession')} · {item.timeframe || t('backtesting.workspace.anyTimeframe')}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, mt: 1 }}>{t('backtesting.compatibility.workspaceLabel')}</Typography>
      <Typography variant="body2" color="text.secondary">{option.instrument} · {option.strategyName || t('backtesting.workspace.unlinkedStrategy')} · {option.session || t('backtesting.workspace.anySession')} · {option.timeframe || t('backtesting.workspace.anyTimeframe')}</Typography>
      <CompatibilityChecklist checks={option.checks} />
    </Paper>
  )
}

function CompatibilityChecklist({ checks }: { checks: BacktestingCompatibilityCheck[] }) {
  const { t } = useI18n()
  return (
    <List component="ul" dense aria-label={t('backtesting.accessibility.compatibilityChecklist')} sx={{ mt: 0.75 }}>
      {checks.map((check, index) => {
        const success = check.matches
        const informational = !success && !check.blocking
        const Icon = success ? CheckCircleOutlineRoundedIcon : informational ? InfoOutlinedIcon : CancelOutlinedIcon
        const color = success ? 'success.main' : informational ? 'info.main' : 'error.main'
        return (
          <ListItem component="li" key={`${check.code}-${index}`} disableGutters sx={{ alignItems: 'flex-start', gap: 1 }}>
            <Icon aria-hidden fontSize="small" sx={{ color, mt: 0.2, flexShrink: 0 }} />
            <Typography variant="body2">{compatibilityText(check, t)}</Typography>
          </ListItem>
        )
      })}
    </List>
  )
}

const fallbackLinkStatus = (item: BacktestingEvidence) => {
  if (item.workspaceId) return item.syncStatus === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'LINKED'
  if (item.syncStatus === 'NEEDS_REVIEW') return 'AMBIGUOUS'
  if (item.syncStatus === 'ERROR') return 'ERROR'
  return 'NOT_LINKED'
}

const compatibilityText = (check: BacktestingCompatibilityCheck, t: (key: string, params?: Record<string, string | number>) => string) => t(`backtesting.compatibility.codes.${check.code}`, {
  trade: check.tradeValue || '',
  workspace: check.workspaceValue || ''
})

const reasonText = (reason: string, t: (key: string) => string) => {
  const known = ['USER_EXCLUDED', 'LIVE_TRADE_DELETED']
  return known.includes(reason) ? t(`backtesting.exclusionReasons.${reason}`) : reason
}

const formatR = (value: number | null | undefined, locale: string) => value === null || value === undefined ? '-' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}R`
const formatDate = (value: string | null | undefined, locale: string) => !value ? '-' : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
