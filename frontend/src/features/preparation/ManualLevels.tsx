import { useState } from 'react'
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { ManualLevel } from '../../api/sessionReviews'
import { useI18n } from '../../i18n'

export function ManualLevelList({ levels, timezone = 'Europe/Bucharest', onEdit, onDelete }: {
  levels: ManualLevel[]; timezone?: string; onEdit?: (level: ManualLevel) => void; onDelete?: (id: string) => void
}) {
  const { t, locale } = useI18n()
  return <Stack spacing={1}>{levels.map(level => <Stack key={level.id} spacing={0.5} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1, overflowWrap: 'anywhere' }}>
    <Typography variant="caption">{t('manualLevels.manual')} · {level.instrument} · {t(`manualLevels.labels.${level.label}`)}</Typography>
    <Typography fontWeight={700}>{new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(level.value)} {level.unit}</Typography>
    {level.note && <Typography variant="caption">{level.note}</Typography>}
    <Typography variant="caption">{level.updatedAt ? `${new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(level.updatedAt))} · ${timezone}` : t('manualLevels.pending')}</Typography>
    {onEdit && onDelete && <Stack direction="row" spacing={1}><Button size="small" onClick={() => onEdit(level)}>{t('manualLevels.edit')}</Button><Button size="small" color="error" onClick={() => onDelete(level.id)}>{t('manualLevels.remove')}</Button></Stack>}
  </Stack>)}</Stack>
}

export default function ManualLevels({ instrument, levels, onChange, timezone }: {
  instrument: string; levels: ManualLevel[]; onChange: (levels: ManualLevel[]) => void; timezone: string
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState<string | null>()
  const [label, setLabel] = useState<ManualLevel['label']>('SUPPORT')
  const [value, setValue] = useState(''), [unit, setUnit] = useState(''), [note, setNote] = useState('')
  const [error, setError] = useState(false)
  const exact = /^[A-Z0-9_]+:[A-Z0-9_!.\-]+$/.test(instrument) && instrument.length <= 100
  const selected = levels.filter(level => level.instrument === instrument)
  const edit = (level?: ManualLevel) => {
    setEditing(level?.id ?? null); setLabel(level?.label ?? 'SUPPORT'); setValue(level ? String(level.value) : '')
    setUnit(level?.unit ?? ''); setNote(level?.note ?? ''); setError(false)
  }
  const save = () => {
    const normalized = value.trim().replace(',', '.')
    if (!/^\d{1,12}(\.\d{1,8})?$/.test(normalized) || !Number.isFinite(Number(normalized)) || Number(normalized) <= 0 || !unit.trim() || (!editing && levels.length >= 40)) { setError(true); return }
    const item: ManualLevel = { id: editing ?? crypto.randomUUID(), instrument, label, value: Number(normalized), unit: unit.trim(), note: note.trim() }
    onChange(editing ? levels.map(level => level.id === editing ? item : level) : [...levels, item]); setEditing(undefined)
  }
  return <Stack spacing={1}>
    <Typography variant="caption">{t('manualLevels.scope')}</Typography>
    <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{instrument}</Typography>
    {!selected.length && <Typography variant="caption">{t('manualLevels.empty')}</Typography>}
    <ManualLevelList levels={selected} timezone={timezone} onEdit={edit} onDelete={id => { onChange(levels.filter(level => level.id !== id)); if (editing === id) setEditing(undefined) }} />
    {editing !== undefined ? <Stack spacing={1}>
      <TextField select size="small" label={t('manualLevels.kind')} value={label} onChange={e => setLabel(e.target.value as ManualLevel['label'])}>{(['SUPPORT', 'RESISTANCE', 'INVALIDATION', 'REFERENCE'] as const).map(key => <MenuItem key={key} value={key}>{t(`manualLevels.labels.${key}`)}</MenuItem>)}</TextField>
      <TextField size="small" label={t('manualLevels.value')} value={value} inputProps={{ inputMode: 'decimal', maxLength: 22 }} onChange={e => setValue(e.target.value)} />
      <TextField size="small" label={t('manualLevels.unit')} value={unit} inputProps={{ maxLength: 30 }} onChange={e => setUnit(e.target.value)} />
      <TextField size="small" label={t('manualLevels.note')} value={note} multiline inputProps={{ maxLength: 500 }} onChange={e => setNote(e.target.value)} />
      {error && <Alert severity="warning">{t('manualLevels.invalid')}</Alert>}
      <Stack direction="row"><Button onClick={save}>{t('manualLevels.apply')}</Button><Button onClick={() => setEditing(undefined)}>{t('manualLevels.cancel')}</Button></Stack>
    </Stack> : <Button size="small" disabled={!exact || levels.length >= 40} onClick={() => edit()}>{t('manualLevels.add')}</Button>}
    {!exact && <Typography variant="caption">{t('manualLevels.exactRequired')}</Typography>}
  </Stack>
}
