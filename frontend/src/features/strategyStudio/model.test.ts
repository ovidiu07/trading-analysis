import { describe, expect, it } from 'vitest'
import {
  conditionText,
  definitionError,
  differences,
  markdown,
  newParameter,
  parameterError,
  references,
  template
} from './model'
describe('Strategy Studio definition', () => {
  it('provides a complete editable Five Sessions starting definition', () => {
    const data = template(true)
    expect(data.definition.metadata).toMatchObject({
      instrument: 'DAX',
      timezone: 'Europe/Bucharest',
      executionTimeframe: '5m',
      contextTimeframe: '1h',
      status: 'Draft'
    })
    expect(data.strategy.sessionSuitability).toEqual(['London', 'New York'])
    expect(definitionError(data.definition)).toBe('')
    const params = Object.fromEntries(data.definition.parameters.map((p) => [p.name, p]))
    expect(params['Minimum FVG size']).toMatchObject({ value: 0.05, unit: '%', type: 'PERCENTAGE' })
    expect(params['Order expiration'].value).toBe(60)
    expect(params['Historical session lookback'].value).toBe(5)
    expect(params['London reference time'].value).toBe('10:15')
    expect(params['New York reference time'].value).toBe('16:15')
    expect(params['Maximum trades per session'].value).toBe(2)
  })
  it('keeps percent values distinct from points and validates both values', () => {
    const p = {
      ...newParameter(),
      type: 'PERCENTAGE' as const,
      unit: '%',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      value: 0.05,
      defaultValue: 0.05
    }
    expect(parameterError(p)).toBe('')
    expect(parameterError(p, 0.051)).toMatch(/step/)
    expect(parameterError(p, 0.5)).toBe('')
    expect(parameterError({ ...p, unit: 'points' })).toMatch(/unit/)
    expect(parameterError(p, NaN)).toMatch(/finite/)
    expect(parameterError(p, 1)).toMatch(/maximum/)
  })
  it.each([
    ['INTEGER', 1.2],
    ['DURATION', -1],
    ['TIME', '25:00'],
    ['TIMEFRAME', '1H'],
    ['BOOLEAN', 'true'],
    ['DROPDOWN', 'missing']
  ])('rejects invalid %s values', (type, value) =>
    expect(
      parameterError({
        ...newParameter(),
        type: type as ReturnType<typeof newParameter>['type'],
        unit: 'minutes',
        value
      })
    ).not.toBe('')
  )
  it('tracks nested parameter references', () => {
    const condition = {
      kind: 'group' as const,
      operator: 'AND' as const,
      children: [
        { kind: 'manual' as const, text: 'Sweep' },
        {
          kind: 'group' as const,
          operator: 'NOT' as const,
          children: [{ kind: 'condition' as const, parameterId: 'fvg', operator: '<' as const, value: 0.05 }]
        }
      ]
    }
    expect(references(condition, 'fvg')).toBe(true)
    expect(conditionText(condition, [{ ...newParameter(), id: 'fvg', name: 'FVG size' }])).toContain(
      'NOT (FVG size < 0.05)'
    )
  })
  it('compares stable identifiers and includes changes in order', () => {
    const a = [
        { id: 'a', name: 'FVG', value: 0.05 },
        { id: 'b', name: 'Expiration', value: 60 }
      ],
      b = [
        { id: 'b', name: 'Expiration', value: 30 },
        { id: 'a', name: 'FVG', value: 0.07 }
      ]
    const diff = differences(a, b)
    expect(diff.some((d) => d.path.includes('FVG / value') && d.after === 0.07)).toBe(true)
    expect(diff.some((d) => d.path.includes('Order'))).toBe(true)
  })
  it('exports all configuration sections without implying profitability', () => {
    const data = { schemaVersion: 1 as const, ...template(true) }
    data.definition.notebook.push({
      id: 'readable-list',
      type: 'BULLET',
      html: '<ul><li>Observe the sweep</li><li>Confirm displacement</li></ul>'
    })
    const md = markdown(data)
    expect(md).toContain('- Observe the sweep\n- Confirm displacement')
    for (const section of ['## Notebook', '## Parameters', '## Presets', '## Rules', '## Checklists', '## Evidence'])
      expect(md).toContain(section)
    expect(md).toContain('0.05')
    expect(md).toContain('Asset binaries')
    expect(md).not.toContain('<script')
  })
})
