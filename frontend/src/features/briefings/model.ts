import { z } from 'zod'
const text = z.string()
const time = z.string().datetime({ offset: true })
const optionalTime = time.nullable().optional()
const url = z.union([z.literal(''), z.string().url().refine(s => /^https?:\/\//.test(s) && !new URL(s).username, 'Use an absolute http(s) URL')]).nullable().optional()
export const slots = ['ASIA', 'LONDON', 'DAY_RECAP'] as const
export type Slot = typeof slots[number]
export const factSchema = z.object({ id: text, time: optionalTime, topic: text, statement: text, source: text, sourceUrl: url, availableAt: optionalTime, availabilityNotEstablished: text.nullable().optional(), relatedFactId: text.nullable().optional(), relationship: z.enum(['UPDATE','CORRECTION','CONTINUATION']).nullable().optional() }).strict()
export const newsSchema = z.object({ headline: text, publishedAt: time, source: text, sourceUrl: url, summary: text, relevance: text }).strict()
export const eventSchema = z.object({ id: text, scheduledAt: time, timezone: text, region: text, name: text, source: text, sourceUrl: url, actual: text.nullable().optional(), forecast: text.nullable().optional(), previous: text.nullable().optional(), unit: text.nullable().optional(), explanation: text.nullable().optional(), status: z.enum(['RELEASED','UPCOMING','RESCHEDULED','CANCELLED']) }).strict()
export const macroSchema = z.object({ instrument: text, type: text, value: z.number().nullable().optional(), unit: text, observedAt: time, source: text, sourceUrl: url, referenceValue: z.number().nullable().optional(), referenceAt: optionalTime, availability: text }).strict()
export const scenarioSchema = z.object({ market: z.enum(['DAX','NASDAQ_100','ES']), instrument: text, source: text, type: text, contract: text.nullable().optional(), context: text, bias: z.enum(['bullish','bearish','neutral','mixed']), main: text, alternative: text, invalidation: text, risks: text, limitations: text }).strict()
export const translationSchema = z.object({ title: text, summary: z.array(text).min(3).max(5), facts: z.array(factSchema).max(100), news: z.array(newsSchema).max(5), events: z.array(eventSchema).max(50), macro: z.array(macroSchema).max(20), scenarios: z.array(scenarioSchema).max(3), sourcesAndLimitations: text }).strict()
export const documentSchema = z.object({ schemaVersion: z.literal(1), editorialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.enum(slots), editorialTimezone: z.literal('Europe/Bucharest'), coverageStart: time, coverageEnd: time, referenceTime: time, coverage: z.enum(['ONGOING','COMPLETE']), author: text, contentLanguage: z.enum(['en','ro']), aiDisclosure: text.nullable().optional(), translations: z.object({ en: translationSchema.optional(), ro: translationSchema.optional() }).strict() }).strict()
export type BriefingDocument = z.infer<typeof documentSchema>
export type Translation = z.infer<typeof translationSchema>
export type Publication = { id: string; briefingId: string; revision: number; publishedAt: string; firstPublishedAt: string; actorId: string; withdrawn: boolean; document: BriefingDocument }
export type Composition = { id: string; kind: 'EDITORIAL'; asOf: string; capturedAt: string; requestedDate: string; requestedSlot: Slot; missingPreferred: boolean; selected?: Publication; composition: Publication[]; previousRecap?: Publication }
export type Selection = Pick<Composition,'selected'|'previousRecap'|'missingPreferred'|'requestedDate'|'requestedSlot'> & { available: Publication[] }
export function editorialDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit' }).format(now) }
export function emptyTranslation(): Translation { return { title:'',summary:['','',''],facts:[],news:[],events:[],macro:[],scenarios:[],sourcesAndLimitations:'' } }
export function emptyDocument(date: string,slot: Slot, language: 'en'|'ro' = 'en'): BriefingDocument {
 const now = new Date().toISOString()
 return {schemaVersion:1,editorialDate:date,slot,editorialTimezone:'Europe/Bucharest',coverageStart:now,coverageEnd:now,referenceTime:now,coverage:'ONGOING',author:'',contentLanguage:language,translations:{[language]:emptyTranslation()}}
}
export function parseImport(raw: string) { if(raw.length>250000)throw Error('document: maximum 250 KB');return documentSchema.parse(JSON.parse(raw)) }
