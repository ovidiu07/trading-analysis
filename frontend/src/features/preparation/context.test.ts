import { describe, it, expect } from 'vitest'
import { selectBriefing, strategyText } from './context'
describe('preparation decisions', () => {
 it.each([['12:59','ASIA'],['13:00','ASIA'],['13:10','ASIA'],['13:15','LONDON'],['13:16','LONDON']])('Bucharest summer threshold %s', (time, expected) => expect(selectBriefing(new Date(`2026-09-04T${time}:00Z`))).toBe(expected))
 it('preserves manual choices and prior briefing during the transition', () => {
  expect(selectBriefing(new Date('2026-09-04T13:10:00Z'), 'LONDON')).toBe('LONDON')
  expect(selectBriefing(new Date('2026-09-04T14:00:00Z'), 'LONDON', 'ASIA')).toBe('ASIA')
 })
 it('uses winter offsets', () => expect(selectBriefing(new Date('2026-01-05T14:15:00Z'))).toBe('LONDON'))
 it('decodes entities and removes active HTML content', () => expect(strategyText('<p>Wait&nbsp;&gt; confirm</p><script>alert(1)</script>')).toBe('Wait > confirm'))
})
