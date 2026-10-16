import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import { ItemActions } from './controls'
import {
  conditionText,
  move,
  newRule,
  numericTypes,
  ruleCategories,
  uid,
  type Condition,
  type Parameter,
  type Rule
} from './model'
import { useStudioText } from './labels'
const manual = (): Condition => ({ kind: 'manual', text: 'Confirm the setup condition' })
function ConditionEditor({
  node,
  parameters,
  onChange,
  depth = 0
}: {
  node: Condition
  parameters: Parameter[]
  onChange: (node: Condition) => void
  depth?: number
}) {
  const s = useStudioText()
  const kindChange = (kind: string) =>
    onChange(
      kind === 'group'
        ? { kind: 'group', operator: 'AND', children: [manual()] }
        : kind === 'manual'
          ? manual()
          : { kind: 'condition', field: 'HTF trend', operator: '=', value: 'Bullish' }
    )
  const select = (
    <TextField
      size="small"
      select
      label={s('Type')}
      value={node.kind}
      onChange={(e) => kindChange(e.target.value)}
      sx={{ minWidth: 180 }}
    >
      <MenuItem value="manual">{s('Manual confirmation')}</MenuItem>
      <MenuItem value="condition">{s('Structured condition')}</MenuItem>
      <MenuItem value="group" disabled={depth >= 8}>
        {s('Condition group')}
      </MenuItem>
    </TextField>
  )
  if (node.kind === 'manual')
    return (
      <Stack spacing={1}>
        {select}
        <TextField
          size="small"
          fullWidth
          label={s('Manual confirmation')}
          multiline
          value={node.text}
          onChange={(e) => onChange({ ...node, text: e.target.value })}
        />
      </Stack>
    )
  if (node.kind === 'group')
    return (
      <Box sx={{ borderLeft: 3, borderColor: 'primary.main', pl: { xs: 1, sm: 2 }, py: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {select}
            <TextField
              select
              size="small"
              label={s('Operator')}
              value={node.operator}
              onChange={(e) =>
                onChange({
                  ...node,
                  operator: e.target.value as 'AND' | 'OR' | 'NOT',
                  children: e.target.value === 'NOT' ? node.children.slice(0, 1) : node.children
                })
              }
            >
              {['AND', 'OR', 'NOT'].map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {node.children.map((child, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={1}>
                <ConditionEditor
                  node={child}
                  parameters={parameters}
                  depth={depth + 1}
                  onChange={(value) =>
                    onChange({ ...node, children: node.children.map((x, j) => (i === j ? value : x)) })
                  }
                />
                <Button
                  size="small"
                  disabled={node.children.length <= 1}
                  onClick={() => onChange({ ...node, children: node.children.filter((_, j) => j !== i) })}
                >
                  {s('Delete condition')}
                </Button>
              </Stack>
            </Paper>
          ))}
          {node.operator !== 'NOT' && node.children.length < 30 && (
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button onClick={() => onChange({ ...node, children: [...node.children, manual()] })}>
                {s('Add condition')}
              </Button>
              <Button
                disabled={depth >= 7}
                onClick={() =>
                  onChange({
                    ...node,
                    children: [...node.children, { kind: 'group', operator: 'OR', children: [manual()] }]
                  })
                }
              >
                {s('Add group')}
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    )
  const p = parameters.find((p) => p.id === node.parameterId)
  const convert = (text: string) =>
    p?.type === 'BOOLEAN'
      ? text.trim().toLowerCase() === 'true'
        ? true
        : text.trim().toLowerCase() === 'false'
          ? false
          : text
      : p && numericTypes.includes(p.type)
        ? Number(text)
        : text.trim()
  const multi = ['IN', 'BETWEEN'].includes(node.operator)
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        {select}
        <TextField
          fullWidth
          size="small"
          select
          label={s('Parameter')}
          value={p ? `p:${p.id}` : 'field'}
          onChange={(e) => {
            const param = parameters.find((p) => `p:${p.id}` === e.target.value)
            onChange(
              param
                ? { kind: 'condition', parameterId: param.id, operator: '=', value: param.value }
                : { kind: 'condition', field: 'HTF trend', operator: '=', value: 'Bullish' }
            )
          }}
        >
          <MenuItem value="field">{s('Observed field')}</MenuItem>
          {parameters
            .filter((p) => p.type !== 'MULTISELECT')
            .map((p) => (
              <MenuItem key={p.id} value={`p:${p.id}`}>
                {p.name}
                {p.unit ? ` (${p.unit})` : ''}
              </MenuItem>
            ))}
        </TextField>
      </Stack>
      {!p && (
        <TextField
          size="small"
          label={s('Observed field')}
          value={node.field || ''}
          onChange={(e) => onChange({ ...node, field: e.target.value })}
        />
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField
          select
          size="small"
          label={s('Operator')}
          value={node.operator}
          onChange={(e) => {
            const operator = e.target.value as typeof node.operator
            const value = Array.isArray(node.value) ? node.value[0] : node.value
            onChange({
              ...node,
              operator,
              value: ['IN', 'BETWEEN'].includes(operator) ? ([value, value] as typeof node.value) : value
            })
          }}
          sx={{ minWidth: 120 }}
        >
          {['=', '!=', '>', '>=', '<', '<=', 'BETWEEN', 'IN'].map((op) => (
            <MenuItem key={op} value={op}>
              {op}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          size="small"
          label={`${s('Value')}${p?.unit ? ` (${p.unit})` : ''}`}
          helperText={
            multi
              ? s('Separate values with commas; BETWEEN requires two.')
              : p?.type === 'BOOLEAN'
                ? 'true / false'
                : s('Observed values are recorded for manual evaluation.')
          }
          value={Array.isArray(node.value) ? node.value.join(', ') : String(node.value)}
          onChange={(e) =>
            onChange({
              ...node,
              value: multi ? (e.target.value.split(',').map(convert) as typeof node.value) : convert(e.target.value)
            })
          }
        />
      </Stack>
    </Stack>
  )
}
export default function Rules({
  rules,
  parameters,
  onChange
}: {
  rules: Rule[]
  parameters: Parameter[]
  onChange: (rules: Rule[]) => void
}) {
  const s = useStudioText()
  const patch = (id: string, data: Partial<Rule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...data } : r)))
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        {s(
          'These rules are structured strategy documentation and manual checks. The existing backtest engine does not execute this custom rule tree.'
        )}
      </Alert>
      <Box>
        <Button variant="contained" onClick={() => onChange([...rules, newRule()])}>
          {s('Add rule')}
        </Button>
      </Box>
      {!rules.length && <Typography color="text.secondary">{s('No rules yet')}</Typography>}
      <datalist id="studio-rule-categories">
        {ruleCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {rules.map((r, index) => (
        <Paper key={r.id} variant="outlined" sx={{ p: { xs: 1.25, sm: 2 } }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
              <Typography variant="subtitle1" fontWeight={700}>
                {index + 1}. {r.name}
              </Typography>
              <ItemActions
                index={index}
                count={rules.length}
                onMove={(n) => onChange(move(rules, index, n))}
                onDuplicate={() =>
                  onChange([
                    ...rules.slice(0, index + 1),
                    { ...structuredClone(r), id: uid(), name: `${r.name} (copy)` },
                    ...rules.slice(index + 1)
                  ])
                }
                onDelete={() => onChange(rules.filter((x) => x.id !== r.id))}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <TextField
                fullWidth
                size="small"
                label={s('Name')}
                value={r.name}
                onChange={(e) => patch(r.id, { name: e.target.value })}
              />
              <TextField
                fullWidth
                size="small"
                label={s('Category')}
                inputProps={{ list: 'studio-rule-categories' }}
                value={r.category}
                onChange={(e) => patch(r.id, { category: e.target.value })}
              />
            </Stack>
            <Stack direction="row" flexWrap="wrap">
              <FormControlLabel
                control={<Switch checked={r.required} onChange={(_, required) => patch(r.id, { required })} />}
                label={s('Required')}
              />
              <FormControlLabel
                control={<Switch checked={r.enabled} onChange={(_, enabled) => patch(r.id, { enabled })} />}
                label={s('Enabled')}
              />
              <Chip
                size="small"
                label={s(r.condition.kind === 'manual' ? 'Manual confirmation' : 'Structured documentation')}
              />
            </Stack>
            <TextField
              size="small"
              multiline
              label={s('Description')}
              value={r.description}
              onChange={(e) => patch(r.id, { description: e.target.value })}
            />
            <ConditionEditor
              node={r.condition}
              parameters={parameters}
              onChange={(condition) => patch(r.id, { condition })}
            />
            <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'action.hover', overflowWrap: 'anywhere' }}>
              <Typography variant="body2">{conditionText(r.condition, parameters)}</Typography>
            </Paper>
            <TextField
              size="small"
              multiline
              label={s('Notes')}
              value={r.notes}
              onChange={(e) => patch(r.id, { notes: e.target.value })}
            />
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}
