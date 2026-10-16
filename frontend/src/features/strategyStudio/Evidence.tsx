import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Link } from 'react-router-dom'
import { listBacktestingTrades, listBacktestingWorkspaces, type BacktestingTrade } from '../../api/backtesting'
import { getStrategyEvidence, linkResearchTrades, listVersions, type StrategyEvidence } from '../../api/strategyStudio'
import type { AssetItem } from '../../api/assets'
import RichTextEditor from '../../components/ui/RichTextEditor'
import SecureAssetImage from '../../components/assets/SecureAssetImage'
import ResearchPerformance from '../backtesting/ResearchPerformance'
import { computeResearchMetrics } from '../backtesting/research'
import { ItemActions } from './controls'
import { move, uid, type Evidence as EvidenceNote, type Studio } from './model'
import { useStudioText } from './labels'

export function Health({
  evidence,
  error,
  retry
}: {
  evidence?: StrategyEvidence
  error?: boolean
  retry: () => void
}) {
  const s = useStudioText()
  if (error)
    return (
      <Alert severity="error" action={<Button onClick={retry}>{s('Retry')}</Button>}>
        {s('Research data could not be loaded.')}
      </Alert>
    )
  if (!evidence) return <Typography color="text.secondary">{s('Loading research data…')}</Typography>
  if (!evidence.trades.length)
    return (
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography fontWeight={700}>{s('No research trades yet')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {s('Link stored backtesting or replay trades to see strategy performance.')}
        </Typography>
      </Paper>
    )
  const m = computeResearchMetrics(evidence.trades)
  const value = (v: number | null | undefined, suffix = '') =>
    v == null ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`
  const cards: [string, string][] = [
    ['Trades', String(m.trades)],
    ['Winning trades', String(m.wins)],
    ['Losing trades', String(m.losses)],
    ['Breakeven trades', String(m.breakevens)],
    ['Win rate', value(m.winRate, '%')],
    ['Profit factor', value(m.profitFactor)],
    ['Average R', value(m.averageR, 'R')],
    ['Expectancy', value(m.expectancy, 'R')],
    ['Maximum drawdown', value(m.maximumDrawdownR, 'R')],
    ['Average win', value(m.averageWinR, 'R')],
    ['Average loss', value(m.averageLossR, 'R')]
  ]
  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' }, gap: 1 }}>
        {cards.map(([label, v]) => (
          <Paper key={label} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {s(label)}
            </Typography>
            <Typography variant="h6" fontWeight={750}>
              {v}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        R coverage: {m.rSampleSize} / {m.trades}.{' '}
        {s(
          'A missing value is unavailable. Profit factor requires a loss denominator. Sample size and high win rate alone do not validate a strategy.'
        )}
      </Typography>
    </Stack>
  )
}
function TradeLinkDialog({
  id,
  onClose,
  onLinked,
  flush
}: {
  id: string
  onClose: () => void
  onLinked: () => void
  flush: () => Promise<Studio>
}) {
  const s = useStudioText(),
    [workspace, setWorkspace] = useState(''),
    [version, setVersion] = useState(''),
    [sample, setSample] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const spaces = useQuery({ queryKey: ['backtesting', 'studioLink'], queryFn: () => listBacktestingWorkspaces(true) })
  const versions = useQuery({ queryKey: ['studioVersions', id], queryFn: () => listVersions(id) })
  const rows = useQuery({
    queryKey: ['studioLinkTrades', workspace],
    queryFn: () => listBacktestingTrades(workspace),
    enabled: Boolean(workspace)
  })
  const trades = (rows.data || []).filter((t) => t.tradeScope !== 'LIVE' && t.source !== 'LIVE')
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await flush()
      await linkResearchTrades(id, { tradeIds: selected, versionId: version || undefined, sample: sample || undefined })
      onLinked()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{s('Link research trades')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            {s(
              'This explicitly assigns the selected stored research trades to this strategy, checkpoint and sample. Existing price, P&L and signal data are preserved. Unspecified clears a previous checkpoint or sample assignment.'
            )}
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {spaces.isError || rows.isError || versions.isError ? (
            <Alert severity="error">{s('Could not load research records. Retry by reopening this dialog.')}</Alert>
          ) : null}
          <TextField
            size="small"
            select
            label={s('Workspace')}
            value={workspace}
            onChange={(e) => {
              setWorkspace(e.target.value)
              setSelected([])
            }}
          >
            <MenuItem value="">{s('Unspecified')}</MenuItem>
            {spaces.data?.workspaces.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.title || w.symbol || w.id}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              size="small"
              fullWidth
              select
              label={s('Strategy version')}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              <MenuItem value="">{s('Unspecified')}</MenuItem>
              {versions.data?.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              fullWidth
              select
              label={s('Research sample')}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            >
              <MenuItem value="">{s('Unspecified')}</MenuItem>
              <MenuItem value="IN_SAMPLE">{s('In sample')}</MenuItem>
              <MenuItem value="OUT_OF_SAMPLE">{s('Out of sample')}</MenuItem>
            </TextField>
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Button
              disabled={!trades.length}
              onClick={() => setSelected(selected.length ? [] : trades.slice(0, 500).map((t) => t.id))}
            >
              {selected.length ? s('Reset') : s('Select all')}
            </Button>
            <Typography variant="body2">{selected.length} / 500</Typography>
          </Stack>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {trades.map((t) => (
              <Stack key={t.id} direction="row" alignItems="center">
                <Checkbox
                  inputProps={{ 'aria-label': `${t.date} ${t.instrument} ${t.id}` }}
                  checked={selected.includes(t.id)}
                  disabled={!selected.includes(t.id) && selected.length >= 500}
                  onChange={(_, checked) =>
                    setSelected(checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))
                  }
                />
                <Box>
                  <Typography variant="body2">
                    {t.date} · {t.instrument} · {t.direction} · {t.result}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.strategyNameSnapshot || s('Unspecified')} · {t.pnlR ?? '—'}R
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {s('Close')}
        </Button>
        <Button onClick={() => void submit()} variant="contained" disabled={busy || !selected.length}>
          {s('Apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
export default function Evidence({
  id,
  data,
  error,
  retry,
  notes,
  onChange,
  assets,
  flush,
  onUpload,
  uploading
}: {
  id: string
  data?: StrategyEvidence
  error: boolean
  retry: () => void
  notes: EvidenceNote[]
  onChange: (notes: EvidenceNote[]) => void
  assets: AssetItem[]
  flush: () => Promise<Studio>
  onUpload: (files: File[]) => Promise<void>
  uploading: boolean
}) {
  const s = useStudioText(),
    client = useQueryClient(),
    [linkOpen, setLinkOpen] = useState(false),
    [filters, setFilters] = useState<Record<string, string>>({})
  const versions = useQuery({ queryKey: ['studioVersions', id], queryFn: () => listVersions(id) })
  const spaces = useQuery({
    queryKey: ['backtesting', 'studioEvidence'],
    queryFn: () => listBacktestingWorkspaces(true)
  })
  const all = useMemo(() => data?.trades || [], [data])
  const filtered = useMemo(
    () =>
      all.filter((t) => {
        const f = filters
        for (const key of [
          'instrument',
          'session',
          'direction',
          'setupType',
          'htfTrend',
          'liquidityType',
          'sweepLevel',
          'gapType',
          'strategyVersionId',
          'researchSample'
        ] as const)
          if (f[key] && String(t[key] || '') !== f[key]) return false
        if ((f.dateFrom && t.date < f.dateFrom) || (f.dateTo && t.date > f.dateTo)) return false
        if (f.fvgMin && (t.gapSizePercent == null || t.gapSizePercent < Number(f.fvgMin))) return false
        if (f.fvgMax && (t.gapSizePercent == null || t.gapSizePercent > Number(f.fvgMax))) return false
        if (f.age && (t.fvgAge == null || t.fvgAge > Number(f.age))) return false
        if (f.relative) {
          const trend = (t.htfTrend || '').toUpperCase()
          const bullish = ['BULLISH', 'UPTREND'].includes(trend),
            bearish = ['BEARISH', 'DOWNTREND'].includes(trend)
          if (!bullish && !bearish) return false
          const withTrend = t.direction === 'LONG' ? bullish : bearish
          if ((f.relative === 'WITH') !== withTrend) return false
        }
        return true
      }),
    [all, filters]
  )
  const patch = (id: string, data: Partial<EvidenceNote>) =>
    onChange(notes.map((e) => (e.id === id ? { ...e, ...data } : e)))
  const set = (key: string, value: string) => setFilters({ ...filters, [key]: value })
  const groups = [...new Set(filtered.map((t) => t.strategyVersionId || ''))]
  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="h6">{s('Backtesting & Evidence')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {s('Stored backtest and replay trades. Live journal results are excluded from this research view.')}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => setLinkOpen(true)}>
          {s('Link research trades')}
        </Button>
      </Stack>
      {linkOpen && (
        <TradeLinkDialog
          id={id}
          onClose={() => setLinkOpen(false)}
          onLinked={() => {
            void client.invalidateQueries({ queryKey: ['studioEvidence', id] })
            void client.invalidateQueries({ queryKey: ['backtesting'] })
          }}
          flush={flush}
        />
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3,1fr)' }, gap: 1 }}>
        {(
          [
            'instrument',
            'session',
            'direction',
            'setupType',
            'htfTrend',
            'liquidityType',
            'sweepLevel',
            'gapType'
          ] as const
        ).map((key, i) => (
          <TextField
            select
            key={key}
            size="small"
            label={s(
              [
                'Instrument',
                'Session',
                'Direction',
                'Setup type',
                'HTF trend',
                'Liquidity swept',
                'Sweep level',
                'FVG type'
              ][i]
            )}
            value={filters[key] || ''}
            onChange={(e) => set(key, e.target.value)}
          >
            <MenuItem value="">{s('All')}</MenuItem>
            {[...new Set(all.map((t) => t[key]).filter(Boolean))].map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
        ))}
        <TextField
          select
          size="small"
          label={s('Strategy version')}
          value={filters.strategyVersionId || ''}
          onChange={(e) => set('strategyVersionId', e.target.value)}
        >
          <MenuItem value="">{s('All')}</MenuItem>
          {versions.data?.map((v) => (
            <MenuItem key={v.id} value={v.id}>
              v{v.versionNumber} · {v.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={s('Research sample')}
          value={filters.researchSample || ''}
          onChange={(e) => set('researchSample', e.target.value)}
        >
          <MenuItem value="">{s('All')}</MenuItem>
          <MenuItem value="IN_SAMPLE">{s('In sample')}</MenuItem>
          <MenuItem value="OUT_OF_SAMPLE">{s('Out of sample')}</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label={s('Direction vs HTF trend')}
          value={filters.relative || ''}
          onChange={(e) => set('relative', e.target.value)}
        >
          <MenuItem value="">{s('All')}</MenuItem>
          <MenuItem value="WITH">{s('With trend')}</MenuItem>
          <MenuItem value="AGAINST">{s('Against trend')}</MenuItem>
        </TextField>
        {['dateFrom', 'dateTo'].map((key, i) => (
          <TextField
            key={key}
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            label={s(['Date from', 'Date to'][i])}
            value={filters[key] || ''}
            onChange={(e) => set(key, e.target.value)}
          />
        ))}
        {['fvgMin', 'fvgMax', 'age'].map((key, i) => (
          <TextField
            key={key}
            size="small"
            type="number"
            label={s(['FVG size min (%)', 'FVG size max (%)', 'FVG age max (bars)'][i])}
            inputProps={{ min: 0, step: key === 'age' ? 1 : 'any' }}
            value={filters[key] || ''}
            onChange={(e) => set(key, e.target.value)}
          />
        ))}
      </Box>
      <Box>
        <Button onClick={() => setFilters({})}>{s('Reset')}</Button>
      </Box>
      {error ? (
        <Alert severity="error" action={<Button onClick={retry}>{s('Retry')}</Button>}>
          {s('Research data could not be loaded.')}
        </Alert>
      ) : !data ? (
        <Typography>{s('Loading research data…')}</Typography>
      ) : !filtered.length ? (
        <Alert severity="info">
          {s('No research trades match this selection. Link trades or adjust the filters.')}
        </Alert>
      ) : (
        <>
          <Health evidence={{ trades: filtered, workspaces: data.workspaces }} retry={retry} />
          <ResearchPerformance trades={filtered} metrics={computeResearchMetrics(filtered)} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{s('Strategy version')}</TableCell>
                  <TableCell>{s('Research sample')}</TableCell>
                  <TableCell>{s('Trades')}</TableCell>
                  <TableCell>{s('Average R')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.flatMap((version) =>
                  ['', 'IN_SAMPLE', 'OUT_OF_SAMPLE'].map((sample) => {
                    const group = filtered.filter(
                      (t) => (t.strategyVersionId || '') === version && (t.researchSample || '') === sample
                    )
                    const m = computeResearchMetrics(group)
                    return group.length ? (
                      <TableRow key={`${version}:${sample}`}>
                        <TableCell>
                          {versions.data?.find((v) => v.id === version)?.name || version || s('Unspecified')}
                        </TableCell>
                        <TableCell>
                          {s(
                            sample === 'IN_SAMPLE'
                              ? 'In sample'
                              : sample === 'OUT_OF_SAMPLE'
                                ? 'Out of sample'
                                : 'Unspecified'
                          )}
                        </TableCell>
                        <TableCell>{m.trades}</TableCell>
                        <TableCell>{m.averageR ?? '—'}</TableCell>
                      </TableRow>
                    ) : null
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      <Typography variant="subtitle1" fontWeight={700}>
        {s('Linked workspaces')}
      </Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {data?.workspaces.map((w) => (
          <Button key={w.id} component={Link} to={`/backtesting/${w.id}`}>
            {w.title || w.symbol || w.id}
          </Button>
        ))}
        <Button component={Link} to="/backtesting">
          {s('Open Backtesting')}
        </Button>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="h6">{s('Research notes')}</Typography>
        <Button
          onClick={() => onChange([...notes, { id: uid(), title: 'Research note', kind: 'Observation', html: '' }])}
        >
          {s('Add evidence')}
        </Button>
      </Stack>
      {notes.map((e, index) => {
        const asset = assets.find((a) => a.id === e.assetId)
        return (
          <Paper variant="outlined" key={e.id} sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
                <Typography fontWeight={700}>{e.title}</Typography>
                <ItemActions
                  index={index}
                  count={notes.length}
                  onMove={(n) => onChange(move(notes, index, n))}
                  onDuplicate={() => onChange([...notes, { ...structuredClone(e), id: uid() }])}
                  onDelete={() => onChange(notes.filter((x) => x.id !== e.id))}
                />
              </Stack>
              <TextField
                size="small"
                label={s('Title')}
                value={e.title}
                onChange={(event) => patch(e.id, { title: event.target.value })}
              />
              <TextField
                size="small"
                label={s('Kind')}
                inputProps={{ list: 'studio-evidence-types' }}
                value={e.kind}
                onChange={(event) => patch(e.id, { kind: event.target.value })}
              />
              <datalist id="studio-evidence-types">
                {['Hypothesis', 'Conclusion', 'Limitation', 'Observation'].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <RichTextEditor
                allowHighlight
                compactToolbar
                minHeight={160}
                ariaLabel={`${s('Research notes')} ${index + 1}`}
                value={e.html}
                onChange={(html) => patch(e.id, { html })}
              />
              <TextField
                size="small"
                select
                label={s('Associated backtest')}
                value={e.workspaceId || ''}
                onChange={(event) => patch(e.id, { workspaceId: event.target.value || undefined })}
              >
                <MenuItem value="">{s('Unspecified')}</MenuItem>
                {spaces.data?.workspaces.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.title || w.symbol || w.id}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                select
                label={s('Image')}
                value={e.assetId || ''}
                onChange={(event) => patch(e.id, { assetId: event.target.value || undefined })}
              >
                <MenuItem value="">{s('Unspecified')}</MenuItem>
                {assets
                  .filter((a) => a.image)
                  .map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.originalFileName}
                    </MenuItem>
                  ))}
              </TextField>
              {asset && (
                <SecureAssetImage
                  url={asset.viewUrl || asset.url}
                  alt={asset.originalFileName}
                  sx={{ width: '100%', maxHeight: 360, objectFit: 'contain' }}
                />
              )}
            </Stack>
          </Paper>
        )
      })}
      <Button component="label" disabled={uploading}>
        {s('Upload image')}
        <input
          hidden
          multiple
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            void onUpload(Array.from(e.target.files || [])).catch(() => {})
            e.target.value = ''
          }}
        />
      </Button>
    </Stack>
  )
}
