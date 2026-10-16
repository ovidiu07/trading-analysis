import type { StrategyRequest, StrategyResponse } from '../../api/strategies'

export type ParameterValue = string | number | boolean | string[]
export type ParameterType =
  | 'NUMBER'
  | 'DECIMAL'
  | 'PERCENTAGE'
  | 'BOOLEAN'
  | 'TEXT'
  | 'DROPDOWN'
  | 'MULTISELECT'
  | 'TIME'
  | 'DURATION'
  | 'TIMEFRAME'
  | 'PRICE_DISTANCE'
  | 'INTEGER'
export type Parameter = {
  id: string
  name: string
  description: string
  category: string
  type: ParameterType
  value: ParameterValue
  defaultValue: ParameterValue
  unit: string
  min?: number
  max?: number
  step?: number
  options: string[]
  enabled: boolean
}
export type Condition =
  | { kind: 'group'; operator: 'AND' | 'OR' | 'NOT'; children: Condition[] }
  | { kind: 'manual'; text: string }
  | {
      kind: 'condition'
      parameterId?: string
      field?: string
      operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'BETWEEN' | 'IN'
      value: ParameterValue | number[] | boolean[]
    }
export type Rule = {
  id: string
  name: string
  description: string
  category: string
  required: boolean
  enabled: boolean
  notes: string
  condition: Condition
}
export type BlockType =
  | 'TEXT'
  | 'HEADING'
  | 'BULLET'
  | 'NUMBERED'
  | 'CHECKLIST'
  | 'TABLE'
  | 'QUOTE'
  | 'CALLOUT'
  | 'DIVIDER'
  | 'IMAGE'
  | 'CODE'
export type Block = {
  id: string
  type: BlockType
  html?: string
  title?: string
  caption?: string
  assetId?: string
  rows?: string[][]
  checked?: boolean
  collapsed?: boolean
}
export type Checklist = {
  id: string
  name: string
  type: string
  items: { id: string; text: string; mandatory: boolean; group: string }[]
}
export type Evidence = { id: string; title: string; kind: string; html: string; workspaceId?: string; assetId?: string }
export type Definition = {
  schemaVersion: 1
  metadata: {
    description?: string
    instrument?: string
    market?: string
    executionTimeframe?: string
    contextTimeframe?: string
    timezone: string
    direction?: string
    status: string
    favorite: boolean
  }
  summary: { hypothesis?: string; context?: string; bias?: string; risk?: string; conditions?: string }
  notebook: Block[]
  parameters: Parameter[]
  presets: { id: string; name: string; values: Record<string, ParameterValue> }[]
  rules: Rule[]
  checklists: Checklist[]
  evidence: Evidence[]
}
export type Studio = { strategy: StrategyResponse; definition: Definition; revision: number }
export type StudioWrite = { strategy: StrategyRequest; definition: Definition; expectedRevision?: number }
export type Portable = { schemaVersion: 1; strategy: StrategyRequest; definition: Definition }
export const uid = () => crypto.randomUUID()
export const numericTypes: ParameterType[] = [
  'NUMBER',
  'DECIMAL',
  'PERCENTAGE',
  'DURATION',
  'PRICE_DISTANCE',
  'INTEGER'
]
export const parameterTypes: ParameterType[] = [
  ...numericTypes,
  'BOOLEAN',
  'TEXT',
  'DROPDOWN',
  'MULTISELECT',
  'TIME',
  'TIMEFRAME'
]
export const statuses = ['Draft', 'Development', 'Backtesting', 'Validated', 'Live', 'Archived']
export const ruleCategories = [
  'Market context',
  'Directional bias',
  'Liquidity conditions',
  'Setup formation',
  'Entry trigger',
  'Stop loss',
  'Take profit',
  'Trade management',
  'Invalidation',
  'Exceptions'
]
export const emptyDefinition = (): Definition => ({
  schemaVersion: 1,
  metadata: { status: 'Draft', favorite: false, timezone: 'Europe/Bucharest' },
  summary: {},
  notebook: [],
  parameters: [],
  presets: [],
  rules: [],
  checklists: [],
  evidence: []
})
export const newParameter = (): Parameter => ({
  id: uid(),
  name: 'New parameter',
  description: '',
  category: 'Market context',
  type: 'DECIMAL',
  value: 0,
  defaultValue: 0,
  unit: '',
  options: [],
  enabled: true
})
export const newRule = (): Rule => ({
  id: uid(),
  name: 'New rule',
  description: '',
  category: 'Market context',
  required: true,
  enabled: true,
  notes: '',
  condition: { kind: 'manual', text: 'Confirm the setup condition' }
})
export const newBlock = (type: BlockType): Block => ({
  id: uid(),
  type,
  ...(type === 'TABLE'
    ? {
        rows: [
          ['Column 1', 'Column 2'],
          ['', '']
        ]
      }
    : type === 'DIVIDER' || type === 'IMAGE'
      ? {}
      : { html: type === 'BULLET' ? '<ul><li></li></ul>' : type === 'NUMBERED' ? '<ol><li></li></ol>' : '' })
})
export const move = <T>(items: T[], index: number, offset: number) => {
  const result = [...items]
  const next = index + offset
  if (next < 0 || next >= result.length) return items
  ;[result[index], result[next]] = [result[next], result[index]]
  return result
}
export const baseRequest = (s: StrategyResponse): StrategyRequest => ({
  name: s.name,
  model: s.model,
  entryConditionsRich: s.entryConditionsRich,
  entryConditions: s.entryConditions,
  invalidationLogic: s.invalidationLogic,
  tpFramework: s.tpFramework,
  noTradeRules: s.noTradeRules,
  sessionSuitability: s.sessionSuitability,
  tags: s.tags,
  archived: s.archived
})
export const writeRequest = (s: Studio): StudioWrite => ({
  strategy: baseRequest(s.strategy),
  definition: s.definition,
  expectedRevision: s.revision
})

export function parameterError(p: Parameter, v: ParameterValue = p.value): string {
  if (numericTypes.includes(p.type)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'A finite number is required'
    if (p.type === 'INTEGER' && !Number.isInteger(v)) return 'An integer is required'
    if (p.type === 'DURATION' && v < 0) return 'Duration cannot be negative'
    if (p.min != null && v < p.min) return 'Value is below minimum'
    if (p.max != null && v > p.max) return 'Value exceeds maximum'
    if (p.min != null && p.max != null && p.min > p.max) return 'Minimum exceeds maximum'
    if (p.step != null) {
      if (p.step <= 0) return 'Step must be positive'
      const units = (v - (p.min ?? 0)) / p.step
      if (Math.abs(units - Math.round(units)) > 1e-7) return 'Value does not match step'
    }
    if (p.type === 'PERCENTAGE' && p.unit !== '%') return 'Percentage unit must be %'
    if (['DURATION', 'PRICE_DISTANCE'].includes(p.type) && !p.unit.trim()) return 'Specify the unit'
  } else if (p.type === 'BOOLEAN') {
    if (typeof v !== 'boolean') return 'True or false is required'
  } else if (p.type === 'MULTISELECT') {
    if (!Array.isArray(v) || v.some((x) => !p.options.includes(x)) || new Set(v).size !== v.length)
      return 'Select available options'
  } else {
    if (typeof v !== 'string') return 'Text is required'
    if (p.type === 'DROPDOWN' && !p.options.includes(v)) return 'Select an available option'
    if (p.type === 'TIME' && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v)) return 'Use HH:mm or HH:mm:ss'
    if (p.type === 'TIMEFRAME' && !/^[1-9]\d{0,4}(s|m|h|d|w|M)$/.test(v)) return 'Use a timeframe such as 5m or 1h'
  }
  return ''
}
export function references(c: Condition, id: string): boolean {
  return c.kind === 'group' ? c.children.some((x) => references(x, id)) : c.kind === 'condition' && c.parameterId === id
}
export function definitionError(d: Definition): string {
  for (const p of d.parameters) {
    if (!p.name.trim() || !p.category.trim()) return 'Parameter name and category are required'
    const error = parameterError(p) || parameterError(p, p.defaultValue)
    if (error) return `${p.name}: ${error}`
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: d.metadata.timezone }).format()
  } catch {
    return 'Use a valid IANA timezone'
  }
  return ''
}
export type Difference = { path: string; before: unknown; after: unknown; kind: 'Added' | 'Removed' | 'Changed' }
export function differences(before: unknown, after: unknown, path = ''): Difference[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    [...before, ...after].every((x) => x && typeof x === 'object' && 'id' in x)
  ) {
    const a = Object.fromEntries(before.map((x) => [x.id, x])),
      b = Object.fromEntries(after.map((x) => [x.id, x]))
    const diff = [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((id) => {
      const item = b[id] || a[id]
      return differences(a[id], b[id], `${path} / ${item.name || item.title || item.text || item.type || id}`)
    })
    if (before.map((x) => x.id).join() !== after.map((x) => x.id).join())
      diff.push({
        path: `${path} / Order`,
        before: before.map((x) => x.name || x.title || x.id),
        after: after.map((x) => x.name || x.title || x.id),
        kind: 'Changed'
      })
    return diff
  }
  if (
    before &&
    after &&
    !Array.isArray(before) &&
    !Array.isArray(after) &&
    typeof before === 'object' &&
    typeof after === 'object'
  ) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      differences(before[key], after[key], `${path} / ${key}`)
    )
  }
  return [
    {
      path: path || 'Definition',
      before,
      after,
      kind: before === undefined ? 'Added' : after === undefined ? 'Removed' : 'Changed'
    }
  ]
}
const plain = (html = '') => {
  const dom = new DOMParser().parseFromString(html, 'text/html')
  dom.querySelectorAll('p,li,br,h1,h2,h3,h4,blockquote,pre').forEach((node) => node.append('\n'))
  return (dom.body.textContent || '').trim()
}
export function markdown(data: Portable): string {
  const { strategy: s, definition: d } = data
  const lines = [
    `# ${s.name}`,
    '',
    d.metadata.description || '',
    '',
    `Model: ${s.model}`,
    ...Object.entries(d.metadata)
      .filter(([k]) => !['favorite', 'description'].includes(k))
      .map(([k, v]) => `${k}: ${v}`),
    `Sessions: ${s.sessionSuitability.join(', ')}`,
    `Categories: ${s.tags.join(', ')}`,
    '',
    '## Strategy summary',
    ...Object.entries(d.summary).flatMap(([k, v]) => [`### ${k}`, plain(v), '']),
    '### Entry philosophy',
    plain(s.entryConditionsRich || s.entryConditions?.join('\n')),
    '### Exit philosophy',
    plain(s.tpFramework),
    '### Invalidation',
    plain(s.invalidationLogic),
    '### Conditions when NOT to trade',
    plain(s.noTradeRules || ''),
    '',
    '## Notebook'
  ]
  for (const b of d.notebook) {
    const text = plain(b.html)
    lines.push(
      b.type === 'HEADING'
        ? `## ${text}`
        : b.type === 'DIVIDER'
          ? '---'
          : b.type === 'CHECKLIST'
            ? `- [${b.checked ? 'x' : ' '}] ${text}`
            : b.type === 'IMAGE'
              ? `[Attached image: ${b.assetId || 'unattached'}] ${b.caption || ''}`
              : b.type === 'BULLET' || b.type === 'NUMBERED'
                ? text
                    .split(/\n+/)
                    .map((line, index) => `${b.type === 'BULLET' ? '-' : `${index + 1}.`} ${line}`)
                    .join('\n')
                : b.type === 'CODE'
                  ? `\`\`\`\n${text}\n\`\`\``
                  : b.type === 'QUOTE'
                    ? `> ${text}`
                    : b.type === 'TABLE'
                      ? (b.rows || [])
                          .map(
                            (row, i) =>
                              `| ${row.join(' | ')} |${i === 0 ? '\n| ' + row.map(() => '---').join(' | ') + ' |' : ''}`
                          )
                          .join('\n')
                      : text,
      ''
    )
  }
  lines.push(
    '## Parameters',
    '| Name | Category | Type | Current | Default | Unit | Min | Max | Step | Enabled |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  )
  d.parameters.forEach((p) =>
    lines.push(
      `| ${p.name} | ${p.category} | ${p.type} | ${formatValue(p.value)} | ${formatValue(p.defaultValue)} | ${p.unit} | ${p.min ?? ''} | ${p.max ?? ''} | ${p.step ?? ''} | ${p.enabled} |`,
      p.description
    )
  )
  lines.push('', '## Presets')
  d.presets.forEach((p) =>
    lines.push(
      `### ${p.name}`,
      ...Object.entries(p.values).map(
        ([id, v]) => `${d.parameters.find((x) => x.id === id)?.name || id}: ${formatValue(v)}`
      )
    )
  )
  lines.push('', '## Rules (structured documentation; manual evaluation)')
  d.rules.forEach((r) =>
    lines.push(
      `### ${r.name}`,
      `${r.category} · ${r.required ? 'Required' : 'Optional'} · ${r.enabled ? 'Enabled' : 'Disabled'}`,
      r.description,
      conditionText(r.condition, d.parameters),
      r.notes,
      ''
    )
  )
  lines.push('## Checklists')
  d.checklists.forEach((c) =>
    lines.push(
      `### ${c.name} (${c.type})`,
      ...c.items.map((i) => `- [ ] ${i.group ? `[${i.group}] ` : ''}${i.text}${i.mandatory ? ' (mandatory)' : ''}`)
    )
  )
  lines.push('', '## Evidence')
  d.evidence.forEach((e) =>
    lines.push(
      `### ${e.title}`,
      e.kind,
      plain(e.html),
      ...(e.workspaceId ? [`Backtest workspace: ${e.workspaceId}`] : []),
      ...(e.assetId ? [`Attached image: ${e.assetId}`] : [])
    )
  )
  lines.push(
    '',
    'Asset binaries and historical trade records are not embedded in this export. Asset IDs are private references that require ownership and attachment access.'
  )
  return lines.join('\n')
}
export const formatValue = (value: unknown) => (typeof value === 'string' ? value : (JSON.stringify(value) ?? '—'))
export function conditionText(c: Condition, params: Parameter[]): string {
  return c.kind === 'manual'
    ? `Manual: ${c.text}`
    : c.kind === 'group'
      ? c.operator === 'NOT'
        ? `NOT (${c.children.map((x) => conditionText(x, params)).join('')})`
        : `(${c.children.map((x) => conditionText(x, params)).join(` ${c.operator} `)})`
      : `${params.find((p) => p.id === c.parameterId)?.name || c.field} ${c.operator} ${formatValue(c.value)}`
}
export function template(five = false): StudioWrite {
  const definition = emptyDefinition()
  const strategy: StrategyRequest = {
    name: five ? 'Five Sessions Model' : 'Untitled strategy',
    model: five ? 'FVG-based session model' : 'Custom strategy',
    entryConditionsRich: '<p>Define the entry trigger.</p>',
    invalidationLogic: 'Define setup invalidation.',
    tpFramework: 'Define the exit framework.',
    noTradeRules: '',
    sessionSuitability: [],
    tags: []
  }
  if (five) {
    definition.metadata = {
      ...definition.metadata,
      instrument: 'DAX',
      market: 'Index',
      executionTimeframe: '5m',
      contextTimeframe: '1h',
      direction: 'Both',
      description: 'Editable research template. No performance or validation is implied.'
    }
    strategy.sessionSuitability = ['London', 'New York']
    strategy.tags = ['FVG', 'Session model']
    definition.summary.hypothesis =
      '<p>Compare the reference price with the high of the configured historical session lookback. If the lookback high is greater, use a bearish bias; otherwise bullish.</p>'
    const add = (
      name: string,
      category: string,
      type: ParameterType,
      value: ParameterValue,
      unit = '',
      extra: Partial<Parameter> = {}
    ) => {
      const p: Parameter = { ...newParameter(), name, category, type, value, defaultValue: value, unit, ...extra }
      definition.parameters.push(p)
      return p
    }
    add('Context timeframe', 'Market context', 'TIMEFRAME', '1h')
    add('Execution timeframe', 'Market context', 'TIMEFRAME', '5m')
    add('Historical session lookback', 'Market context', 'INTEGER', 5, 'sessions', { min: 1, step: 1 })
    add('London reference time', 'Market context', 'TIME', '10:15')
    add('New York reference time', 'Market context', 'TIME', '16:15')
    add('Minimum FVG size', 'FVG', 'PERCENTAGE', 0.05, '%', {
      min: 0.01,
      max: 0.5,
      step: 0.01,
      description: 'Three-candle gap size as a percentage of price. 0.05 means 0.05%.'
    })
    add('Entry model', 'Entry', 'DROPDOWN', 'FVG mitigation', '', {
      options: ['FVG mitigation', 'FVG touch', 'Custom confirmation']
    })
    add('Order expiration', 'Entry', 'DURATION', 60, 'minutes', { min: 1, step: 1 })
    add('Maximum trades per session', 'Entry', 'INTEGER', 2, 'trades', { min: 1, step: 1 })
    add('Second entry requires first stop-out', 'Entry', 'BOOLEAN', true)
    definition.rules = [
      'If the historical session high exceeds the configured reference price, bias is bearish; otherwise bullish.',
      'Entry must satisfy the configured FVG-based entry model.',
      'A second session entry is allowed only after the first trade was stopped out.'
    ].map((text, i) => ({
      ...newRule(),
      name: ['Directional context', 'FVG entry', 'Second entry permission'][i],
      category: i ? 'Entry trigger' : 'Directional bias',
      condition: { kind: 'manual', text }
    }))
    definition.notebook = [
      {
        ...newBlock('CALLOUT'),
        html: '<p>Starting structure for research. Define unspecified risk, sweep, invalidation and exit conditions before testing. Reference times use Europe/Bucharest, including daylight saving time.</p>'
      }
    ]
    definition.checklists = [
      {
        id: uid(),
        name: 'Pre-trade checklist',
        type: 'Pre-trade',
        items: [
          'Higher timeframe analyzed',
          'Directional bias established',
          'Relevant liquidity identified',
          'Entry trigger confirmed',
          'Stop-loss defined',
          'Take-profit defined',
          'Risk/reward acceptable',
          'News checked'
        ].map((text) => ({ id: uid(), text, mandatory: true, group: 'Entry readiness' }))
      }
    ]
  }
  return { strategy, definition }
}
