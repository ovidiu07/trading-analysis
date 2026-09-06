import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { AdviceCard } from '../../api/analytics'
import { getTradeById } from '../../api/trades'
import { formatNetResult } from '../../utils/tradeMoney'
import { useI18n } from '../../i18n'

export default function FindingEvidenceDialog({ finding, onClose }: { finding: AdviceCard | null; onClose: () => void }) {
  const { t } = useI18n()
  const ids = finding?.tradeIds
  const query = useQuery({ queryKey: ['findingEvidence', finding?.id, ids], enabled: Boolean(finding && ids), queryFn: async () => {
    const rows = []
    for (let offset = 0; offset < (ids?.length || 0); offset += 8) rows.push(...await Promise.all(ids!.slice(offset, offset + 8).map(getTradeById)))
    return rows
  } })
  const stale = query.data?.some(trade => finding?.generatedAt && trade.updatedAt && new Date(trade.updatedAt) > new Date(finding.generatedAt))
  return <Dialog open={Boolean(finding)} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{finding?.title}</DialogTitle><DialogContent><Stack spacing={1.5}>
    <Typography>{t('analytics.coach.exactEvidence', { count: ids?.length ?? '—' })}</Typography>
    <Typography variant="caption">{finding?.ruleVersion} · {finding?.dateBasis} · {finding?.timezone}<br />{finding?.from || '—'} → {finding?.to || '—'}</Typography>
    <Alert severity="info">{t('analytics.coach.evidenceLimitations')}</Alert>
    {!ids || query.isError || stale ? <Alert severity="warning">{t('analytics.coach.staleEvidence')}</Alert> : query.isLoading ? <Typography role="status">{t('dailyReview.loading')}</Typography> : query.data?.map(trade => <Button key={trade.id} component={Link} to={`/trades?tradeId=${trade.id}${trade.accountRefId ? `&accountIds=${trade.accountRefId}` : ''}`} variant="outlined" sx={{ justifyContent: 'space-between' }}><span>{trade.symbol} · {trade.closedAt || trade.openedAt}</span><span>{formatNetResult(trade)}</span></Button>)}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>{t('common.close')}</Button></DialogActions></Dialog>
}
