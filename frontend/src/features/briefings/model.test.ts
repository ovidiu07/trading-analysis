import { describe,it,expect } from 'vitest'
import { emptyDocument,parseImport,editorialDate,eventSchema } from './model'
describe('untrusted structured editorial import',()=>{
 it.each(['ASIA','LONDON','DAY_RECAP'] as const)('accepts empty structured %s template',slot=>{const d=emptyDocument('2026-09-07',slot);expect(parseImport(JSON.stringify(d))).toEqual(d)})
 it('does not carry old facts into a new date',()=>{const a=emptyDocument('2026-09-07','ASIA');a.translations.en!.summary[0]='old';expect(emptyDocument('2026-09-08','ASIA').translations.en!.summary).toEqual(['','',''])})
 it.each(['role','owner','status','publishedAt','athDistance','widgetValues'])('rejects supplied %s',field=>expect(()=>parseImport(JSON.stringify({...emptyDocument('2026-09-07','ASIA'),[field]:'x'}))).toThrow())
 it.each(['javascript:alert(1)','data:text/html,evil','https://user:pass@example.com'])('rejects unsafe source %s',sourceUrl=>{const d=emptyDocument('2026-09-07','ASIA');d.translations.en!.facts=[{id:'x',topic:'x',statement:'x',source:'x',sourceUrl}];expect(()=>parseImport(JSON.stringify(d))).toThrow()})
 it('preserves malformed original input for recovery',()=>{const raw='{bad JSON';expect(()=>parseImport(raw)).toThrow();expect(raw).toBe('{bad JSON')})
 it('keeps literal HTML as non-executable text',()=>{const d=emptyDocument('2026-09-07','ASIA');d.translations.en!.summary[0]='<script>alert(1)</script> &amp;';expect(parseImport(JSON.stringify(d)).translations.en!.summary[0]).toBe('<script>alert(1)</script> &amp;')})
 it('uses Bucharest editorial date independently of Berlin selection clock',()=>expect(editorialDate(new Date('2026-09-06T21:30:00Z'))).toBe('2026-09-07'))
})

it('accepts an exact EIA series-period release with its provenance and no invented schedule',()=>{
 const result=eventSchema.parse({id:'eia-release',scheduledAt:null,scheduledDate:'2026-09-23',publishedAt:'2026-09-23T14:30:00Z',timezone:'America/New_York',region:'US',name:'Commercial crude oil stocks',source:'EIA',sourceUrl:'https://ir.eia.gov/wpsr/psw00.json',actual:'400000',unit:'thousand barrels',status:'RELEASED',official:{sourceId:'EIA',eventId:'WCESTUS1|2026-09-18',sourceEventId:'WCESTUS1|2026-09-18',identityBasis:'EXACT_SERIES_PERIOD',revisionId:'12345678-1234-4234-8234-123456789012',retrievedAt:'2026-09-25T10:00:00Z',seriesId:'WCESTUS1',referencePeriod:'2026-09-18'}})
 expect(result.scheduledAt).toBeNull();expect(result.forecast).toBeUndefined();expect(result.previous).toBeUndefined()
})
