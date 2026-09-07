import { describe, it, expect } from 'vitest'
import { selectBriefing, strategyText } from './context'
describe('Berlin product selection thresholds', () => {
 it.each([
 ['2026-09-07T07:00:00Z','ASIA'],['2026-09-07T14:14:59Z','ASIA'],['2026-09-07T14:15:00Z','LONDON'],
 ['2026-09-07T20:29:59Z','LONDON'],['2026-09-07T20:30:00Z','DAY_RECAP'],
 ['2026-01-05T15:14:59Z','ASIA'],['2026-01-05T15:15:00Z','LONDON'],['2026-01-05T21:30:00Z','DAY_RECAP'],
 ['2026-03-09T15:15:00Z','LONDON'],['2026-03-30T14:15:00Z','LONDON'],['2026-10-26T15:15:00Z','LONDON'],
 ['2026-09-07T21:59:59Z','DAY_RECAP'],['2026-09-07T22:00:00Z','ASIA'],
 ['2026-03-29T00:59:59Z','ASIA'],['2026-03-29T01:00:00Z','ASIA'],['2026-10-25T00:59:59Z','ASIA'],['2026-10-25T01:00:00Z','ASIA']
 ])('%s → %s',(time,expected)=>expect(selectBriefing(new Date(time))).toBe(expected))
 it('manual selection takes precedence',()=>expect(selectBriefing(new Date('2026-09-07T20:30:00Z'),'ASIA','LONDON')).toBe('LONDON'))
 it('does not mutate an active preparation when clock changes',()=>{const active={briefingSession:selectBriefing(new Date('2026-09-07T07:00:00Z'))};selectBriefing(new Date('2026-09-07T20:30:00Z'));expect(active.briefingSession).toBe('ASIA')})
 it('decodes legacy strategy entities and removes active HTML content',()=>expect(strategyText('<p>Wait&nbsp;&gt; confirm</p><script>alert(1)</script>')).toBe('Wait > confirm'))
})
