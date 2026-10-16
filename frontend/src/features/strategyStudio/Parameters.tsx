import { useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { ItemActions } from './controls'
import {
  differences,
  formatValue,
  move,
  newParameter,
  numericTypes,
  parameterError,
  parameterTypes,
  references,
  uid,
  type Definition,
  type Parameter,
  type ParameterType,
  type ParameterValue
} from './model'
import { useStudioText } from './labels'

export function ValueInput({
  parameter: p,
  value,
  onChange,
  label = 'Current value'
}: {
  parameter: Parameter
  value: ParameterValue
  onChange: (value: ParameterValue) => void
  label?: string
}) {
  const s = useStudioText()
  const error = parameterError(p, value)
  if (p.type === 'BOOLEAN')
    return (
      <FormControlLabel
        control={<Switch checked={value === true} onChange={(_, v) => onChange(v)} />}
        label={s(label)}
      />
    )
  const choices = ['DROPDOWN', 'MULTISELECT'].includes(p.type)
  return (
    <TextField
      fullWidth
      size="small"
      label={`${s(label)}${p.unit ? ` (${p.unit})` : ''}`}
      select={choices}
      SelectProps={p.type === 'MULTISELECT' ? { multiple: true } : undefined}
      type={numericTypes.includes(p.type) ? 'number' : p.type === 'TIME' ? 'time' : 'text'}
      InputLabelProps={p.type === 'TIME' ? { shrink: true } : undefined}
      value={typeof value === 'number' && !Number.isFinite(value) ? '' : value}
      error={Boolean(error)}
      helperText={
        error
          ? s(error)
          : p.type === 'PERCENTAGE'
            ? s('0.05 means 0.05%; no price-point conversion.')
            : p.type === 'TIMEFRAME'
              ? '5m · 1h · 1d'
              : undefined
      }
      inputProps={{ min: p.min, max: p.max, step: p.step ?? 'any' }}
      onChange={(e) =>
        onChange(
          p.type === 'MULTISELECT'
            ? typeof e.target.value === 'string'
              ? e.target.value.split(',')
              : e.target.value
            : numericTypes.includes(p.type)
              ? e.target.value === ''
                ? NaN
                : Number(e.target.value)
              : e.target.value
        )
      }
    >
      {choices
        ? p.options.map((o) => (
            <MenuItem key={o} value={o}>
              {o}
            </MenuItem>
          ))
        : undefined}
    </TextField>
  )
}
export default function Parameters({
  definition: d,
  onChange
}: {
  definition: Definition
  onChange: (d: Definition) => void
}) {
  const s = useStudioText(),
    [search, setSearch] = useState(''),
    [presetName, setPresetName] = useState(''),
    [compare, setCompare] = useState(''),
    [compareAgainst, setCompareAgainst] = useState(''),
    [categoryEditing, setCategoryEditing] = useState<{ id: string; category: string } | null>(null)
  const patch = (id: string, data: Partial<Parameter>) =>
    onChange({ ...d, parameters: d.parameters.map((p) => (p.id === id ? { ...p, ...data } : p)) })
  const changeType = (p: Parameter, type: ParameterType) => {
    const value: ParameterValue =
      type === 'BOOLEAN'
        ? false
        : type === 'MULTISELECT'
          ? []
          : numericTypes.includes(type)
            ? 0
            : type === 'TIME'
              ? '10:15'
              : type === 'TIMEFRAME'
                ? '5m'
                : type === 'DROPDOWN'
                  ? p.options[0] || 'Option 1'
                  : ''
    patch(p.id, {
      type,
      value,
      defaultValue: value,
      unit: type === 'PERCENTAGE' ? '%' : type === 'DURATION' ? 'minutes' : type === 'PRICE_DISTANCE' ? 'points' : '',
      min: undefined,
      max: undefined,
      step: undefined,
      options: type === 'DROPDOWN' && !p.options.length ? ['Option 1'] : p.options
    })
  }
  const displayCategory = (p: Parameter) => (categoryEditing?.id === p.id ? categoryEditing.category : p.category)
  const categories = [...new Set(d.parameters.map(displayCategory))]
  const preset = d.presets.find((p) => p.id === compare)
  const target = d.presets.find((p) => p.id === compareAgainst)
  const comparison = target?.values || Object.fromEntries(d.parameters.map((p) => [p.id, p.value]))
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
        <TextField
          size="small"
          label={s('Search parameters')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="contained" onClick={() => onChange({ ...d, parameters: [...d.parameters, newParameter()] })}>
          {s('Add parameter')}
        </Button>
      </Stack>
      {!d.parameters.length && <Alert severity="info">{s('No parameters yet')}</Alert>}
      <Box component="datalist" id="studio-parameter-categories">
        {['Market context', 'Liquidity', 'FVG', 'Entry', 'Risk management', ...categories]
          .filter((x, i, a) => a.indexOf(x) === i)
          .map((c) => (
            <option key={c} value={c} />
          ))}
      </Box>
      {categories
        .filter((category) =>
          d.parameters.some(
            (p) =>
              displayCategory(p) === category &&
              `${p.name} ${p.description} ${displayCategory(p)}`.toLowerCase().includes(search.toLowerCase())
          )
        )
        .map((category) => (
          <Stack spacing={1.5} key={category}>
            <Typography variant="overline" color="text.secondary">
              {category}
            </Typography>
            {d.parameters
              .filter(
                (p) =>
                  displayCategory(p) === category &&
                  `${p.name} ${p.description} ${displayCategory(p)}`.toLowerCase().includes(search.toLowerCase())
              )
              .map((p) => {
                const index = d.parameters.findIndex((x) => x.id === p.id)
                const referenced =
                  d.rules.some((r) => references(r.condition, p.id)) ||
                  d.presets.some((x) => Object.prototype.hasOwnProperty.call(x.values, p.id))
                return (
                  <Paper variant="outlined" key={p.id} sx={{ p: 1.5 }}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                        <Typography fontWeight={700} sx={{ flex: 1 }}>
                          {p.name}
                        </Typography>
                        <Chip size="small" label={`${p.type}${p.unit ? ` · ${p.unit}` : ''}`} />
                        <FormControlLabel
                          control={<Switch checked={p.enabled} onChange={(_, enabled) => patch(p.id, { enabled })} />}
                          label={s('Enabled')}
                        />
                        <ItemActions
                          index={index}
                          count={d.parameters.length}
                          onMove={(n) => onChange({ ...d, parameters: move(d.parameters, index, n) })}
                          onDuplicate={() =>
                            onChange({
                              ...d,
                              parameters: [
                                ...d.parameters.slice(0, index + 1),
                                { ...structuredClone(p), id: uid(), name: `${p.name} (copy)` },
                                ...d.parameters.slice(index + 1)
                              ]
                            })
                          }
                          onDelete={() => onChange({ ...d, parameters: d.parameters.filter((x) => x.id !== p.id) })}
                          deleteDisabled={referenced}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                        <Box sx={{ flex: 1 }}>
                          <ValueInput parameter={p} value={p.value} onChange={(value) => patch(p.id, { value })} />
                        </Box>
                        <Button onClick={() => patch(p.id, { value: structuredClone(p.defaultValue) })}>
                          {s('Reset to default')}
                        </Button>
                      </Stack>
                      <Accordion
                        TransitionProps={{ unmountOnExit: true }}
                        disableGutters
                        elevation={0}
                        sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreRounded />}>{s('Advanced details')}</AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                          <Stack spacing={1.5}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                              <TextField
                                size="small"
                                label={s('Name')}
                                value={p.name}
                                onChange={(e) => patch(p.id, { name: e.target.value })}
                              />
                              <TextField
                                size="small"
                                label={s('Category')}
                                inputProps={{ list: 'studio-parameter-categories' }}
                                value={p.category}
                                onFocus={() => setCategoryEditing({ id: p.id, category: p.category })}
                                onChange={(e) => patch(p.id, { category: e.target.value })}
                                onBlur={() => setCategoryEditing(null)}
                              />
                              <TextField
                                select
                                size="small"
                                label={s('Type')}
                                value={p.type}
                                onChange={(e) => changeType(p, e.target.value as ParameterType)}
                              >
                                {parameterTypes.map((type) => (
                                  <MenuItem key={type} value={type}>
                                    {type}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                size="small"
                                label={s('Unit')}
                                value={p.unit}
                                disabled={p.type === 'PERCENTAGE'}
                                onChange={(e) => patch(p.id, { unit: e.target.value })}
                              />
                              <ValueInput
                                parameter={p}
                                value={p.defaultValue}
                                label="Default value"
                                onChange={(defaultValue) => patch(p.id, { defaultValue })}
                              />
                            </Box>
                            <TextField
                              size="small"
                              multiline
                              label={s('Description')}
                              value={p.description}
                              onChange={(e) => patch(p.id, { description: e.target.value })}
                            />
                            {numericTypes.includes(p.type) && (
                              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                                {(['min', 'max', 'step'] as const).map((key, i) => (
                                  <TextField
                                    key={key}
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={s(['Minimum', 'Maximum', 'Step'][i])}
                                    value={p[key] ?? ''}
                                    onChange={(e) =>
                                      patch(p.id, { [key]: e.target.value === '' ? undefined : Number(e.target.value) })
                                    }
                                  />
                                ))}
                              </Stack>
                            )}
                            {['DROPDOWN', 'MULTISELECT'].includes(p.type) && (
                              <TextField
                                size="small"
                                label={s('Options')}
                                helperText={s('One option per line')}
                                multiline
                                value={p.options.join('\n')}
                                onChange={(e) => patch(p.id, { options: e.target.value.split('\n') })}
                              />
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  </Paper>
                )
              })}
          </Stack>
        ))}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">{s('Presets')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              size="small"
              label={s('Preset name')}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <Button
              disabled={!presetName.trim() || d.parameters.some((p) => Boolean(parameterError(p)))}
              onClick={() => {
                onChange({
                  ...d,
                  presets: [
                    ...d.presets,
                    {
                      id: uid(),
                      name: presetName.trim(),
                      values: Object.fromEntries(d.parameters.map((p) => [p.id, structuredClone(p.value)]))
                    }
                  ]
                })
                setPresetName('')
              }}
            >
              {s('Save preset')}
            </Button>
          </Stack>
          {d.presets.map((p) => (
            <Stack direction="row" key={p.id} gap={1} flexWrap="wrap" alignItems="center">
              <TextField
                size="small"
                label={s('Name')}
                value={p.name}
                onChange={(e) =>
                  onChange({
                    ...d,
                    presets: d.presets.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x))
                  })
                }
              />
              <Button
                onClick={() =>
                  onChange({
                    ...d,
                    parameters: d.parameters.map((x) =>
                      p.values[x.id] === undefined ? x : { ...x, value: structuredClone(p.values[x.id]) }
                    )
                  })
                }
              >
                {s('Apply')}
              </Button>
              <Button onClick={() => setCompare(compare === p.id ? '' : p.id)}>{s('Compare')}</Button>
              <Button onClick={() => onChange({ ...d, presets: d.presets.filter((x) => x.id !== p.id) })}>
                {s('Delete')}
              </Button>
            </Stack>
          ))}
          {preset && (
            <>
              <TextField
                select
                size="small"
                label={s('Compare against')}
                value={compareAgainst}
                onChange={(e) => setCompareAgainst(e.target.value)}
              >
                <MenuItem value="">{s('Current value')}</MenuItem>
                {d.presets
                  .filter((p) => p.id !== preset.id)
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
              </TextField>
              {!d.parameters.some((p) => differences(preset.values[p.id], comparison[p.id]).length) && (
                <Typography color="text.secondary">{s('No differences')}</Typography>
              )}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{s('Parameter')}</TableCell>
                      <TableCell>{preset.name}</TableCell>
                      <TableCell>{target?.name || s('Current value')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.parameters
                      .filter((p) => differences(preset.values[p.id], comparison[p.id]).length)
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>
                            {formatValue(preset.values[p.id])} {p.unit}
                          </TableCell>
                          <TableCell>
                            {formatValue(comparison[p.id])} {p.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
