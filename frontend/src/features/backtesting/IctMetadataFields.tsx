import { useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Button, Grid, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import type { BacktestingTrade, BacktestingTradePayload } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { copyTradeContext, directionVsHtf, ictFields, ictGroups, validIctNumbers, type IctKey } from './ictMetadata'

export default function IctMetadataFields({ draft, onChange, previous }: {
  draft: BacktestingTradePayload
  onChange: (patch: Partial<BacktestingTradePayload>) => void
  previous?: BacktestingTrade
}) {
  const { t, language } = useI18n()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const alignment = directionVsHtf(draft.direction, draft.htfTrend)
  const control = (field: typeof ictFields[number]) => {
    const key = field.key as IctKey
    const label = field.label[language]
    const raw = draft[key]
    if (field.kind === 'select') {
      // Keep legacy values visible and clearable without adding arbitrary free text.
      const options = [...field.options]
      const value = raw == null || raw === '' ? null : options.find(o => o.value === raw)
        || { value: String(raw), label: { en: String(raw), ro: String(raw) }, aliases: [] }
      if (value && !options.some(o => o.value === value.value)) options.push(value)
      return <Autocomplete size="small" fullWidth options={options} value={value} getOptionLabel={o => o.label[language]}
        isOptionEqualToValue={(a, b) => a.value === b.value} onChange={(_, selected) => onChange({ [key]: selected?.value ?? null })}
        openText={t('backtesting.ict.open')} closeText={t('backtesting.ict.close')} clearText={t('backtesting.ict.clear')}
        ListboxProps={{ style: { maxHeight: 240 } }} renderInput={params => <TextField {...params} label={label} placeholder={t('backtesting.ict.unspecified')} />} />
    }
    const unit = field.kind === 'integer' ? t('backtesting.ict.bars') : key === 'gapSizePercent' ? '%' : t('backtesting.ict.points')
    const invalid = raw != null && !validIctNumbers({ [key]: raw })
    return <TextField size="small" fullWidth type="number" label={label} value={raw ?? ''} error={invalid}
      helperText={invalid ? t('backtesting.ict.invalidNumber') : key === 'fvgAge' ? t('backtesting.ict.ageHelp') : key === 'gapSizePercent' ? t('backtesting.ict.percentHelp') : undefined}
      inputProps={{ min: 0, step: field.kind === 'integer' ? 1 : 10 ** -field.scale }}
      InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
      onChange={event => onChange({ [key]: event.target.value === '' ? null : Number(event.target.value) })} />
  }
  return <Stack spacing={1.5} sx={{ mt: 2 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
      <Typography variant="h6" component="h2">{t('backtesting.ict.title')}</Typography>
      <Button size="small" disabled={!previous} onClick={() => { if (previous) { onChange(copyTradeContext(previous)); setCopied(true) } }}>{t('backtesting.ict.copy')}</Button>
    </Stack>
    <Typography variant="caption" color="text.secondary">{t('backtesting.ict.entrySnapshot')}</Typography>
    {copied && previous && <Alert severity="success">{t('backtesting.ict.copied', { date: previous.date, time: previous.entryTime })}</Alert>}
    {ictGroups.map(group => <Stack key={group} spacing={1}>
      <Typography variant="subtitle2" component="h3">{t(`backtesting.ict.groups.${group}`)}</Typography>
      <Grid container spacing={1.5}>{group === 'setup' && draft.source === 'LIVE' && <Grid item xs={12} sm={6}><TextField fullWidth size="small" label={t('backtesting.trades.direction')} value={t(`backtesting.direction.${draft.direction}`)} InputProps={{ readOnly: true }} /></Grid>}{ictFields.filter(f => f.group === group && f.quick).map(field => <Grid item xs={12} sm={6} key={field.key}>{control(field)}</Grid>)}</Grid>
      {group === 'htf' && <TextField size="small" label={t('backtesting.ict.alignment')} value={alignment ? t(`backtesting.ict.${alignment}`) : t('backtesting.ict.unspecified')} InputProps={{ readOnly: true }} />}
      <Accordion disableGutters elevation={0} expanded={Boolean(expanded[group])} onChange={(_, value) => setExpanded(state => ({ ...state, [group]: value }))} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} aria-controls={`ict-${group}-content`} id={`ict-${group}-header`}><Typography variant="body2">{t('backtesting.ict.more', { group: t(`backtesting.ict.groups.${group}`) })}</Typography></AccordionSummary>
        <AccordionDetails id={`ict-${group}-content`}><Grid container spacing={1.5}>{ictFields.filter(f => f.group === group && !f.quick).map(field => <Grid item xs={12} sm={6} key={field.key}>{control(field)}</Grid>)}</Grid>{group === 'fvg' && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{t('backtesting.ict.locationHelp')}</Typography>}</AccordionDetails>
      </Accordion>
    </Stack>)}
  </Stack>
}
