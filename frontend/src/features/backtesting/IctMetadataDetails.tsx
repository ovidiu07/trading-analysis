import { Box, Grid, Stack, Typography } from '@mui/material'
import type { BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { directionVsHtf, ictFields, ictGroups, type IctKey } from './ictMetadata'

export default function IctMetadataDetails({ trade }: { trade: BacktestingTrade }) {
  const { t, language } = useI18n()
  const alignment = directionVsHtf(trade.direction, trade.htfTrend)
  return <Stack spacing={2} sx={{ mt: 2 }}><Typography variant="h6" component="h2">{t('backtesting.ict.title')}</Typography>{ictGroups.map(group => {
    const saved = ictFields.filter(f => f.group === group && trade[f.key as IctKey] != null && trade[f.key as IctKey] !== '')
    return <Box key={group}><Typography variant="subtitle2" component="h3" gutterBottom>{t(`backtesting.ict.groups.${group}`)}</Typography><Grid container spacing={1}>
      {group === 'setup' && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">{t('backtesting.trades.direction')}</Typography><Typography variant="body2">{trade.direction ? t(`backtesting.direction.${trade.direction}`) : t('backtesting.ict.unspecified')}</Typography></Grid>}
      {saved.map(field => { const value = trade[field.key as IctKey]; const label = field.options.find(o => o.value === value)?.label[language]
        return <Grid item xs={12} sm={6} key={field.key}><Typography variant="caption" color="text.secondary">{field.label[language]}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{label ?? String(value)}{field.key === 'gapSizePercent' ? '%' : field.key === 'gapSizePoints' ? ` ${t('backtesting.ict.points')}` : field.key === 'fvgAge' ? ` ${t('backtesting.ict.bars')}` : ''}</Typography></Grid> })}
      {group === 'htf' && alignment && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">{t('backtesting.ict.alignment')}</Typography><Typography variant="body2">{t(`backtesting.ict.${alignment}`)}</Typography></Grid>}
    </Grid>{!saved.length && <Typography variant="body2" color="text.secondary">{t('backtesting.ict.unspecified')}</Typography>}</Box>
  })}</Stack>
}
