import { pruneTemplateFields, templateFieldRecordFromContent, templateFieldsForType } from './contentTemplateConfig'

describe('contentTemplateConfig', () => {
  it('returns known template fields for daily plans', () => {
    const fields = templateFieldsForType('DAILY_PLAN')
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.some((field) => field.key === 'biasSummary' && field.required)).toBe(true)
  })

  it('maps stored template values to the selected schema', () => {
    const mapped = templateFieldRecordFromContent('STRATEGY', {
      what: 'What it is',
      filters: 'A+ filters',
      unknown: 'ignored'
    })

    expect(mapped.what).toBe('What it is')
    expect(mapped.filters).toBe('A+ filters')
    expect(mapped).not.toHaveProperty('unknown')
    expect(mapped.entryModel).toBe('')
  })

  it('prunes empty template fields and trims values', () => {
    const pruned = pruneTemplateFields({
      what: '  Sweep + MSS  ',
      riskModel: '   ',
      checklist: '\nA\nB\n'
    })

    expect(pruned).toEqual({
      what: 'Sweep + MSS',
      checklist: 'A\nB'
    })
  })
})
