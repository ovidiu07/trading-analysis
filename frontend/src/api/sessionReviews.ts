import { apiGet, apiPut } from './client'
export type ReviewState = 'PREPARE' | 'TRADE' | 'REVIEW' | 'COMPLETE'
export type Assessment = { tradeId: string; decision: 'FOLLOWED' | 'DEVIATED' | 'CANNOT_ASSESS'; note: string }
export type Preparation = {
  briefingDate?: string; briefingId?: string; step: number; briefingSession: 'ASIA' | 'LONDON' | 'DAY_RECAP'; manualSession: boolean;
  bias: 'bullish' | 'bearish' | 'neutral' | 'mixed'; chartPlan: string; chartSymbol: string;
  chartInterval: string; observing: boolean; contextAcknowledged: boolean;
  chartConfirmed: boolean; preparationConfirmed: boolean; checklist: boolean[];
}
export type SessionReview = {
  preparation?: Preparation;
  readyContext?: { readyAt: string; revision: number; focus: string; instruments: string; preparation: Preparation; briefing?: { asOf: string; id: string; kind?: string } & Partial<import('../features/briefings/model').Composition>; strategyContext?: SessionReview['strategyContext'] };
  state: ReviewState; instruments: string; strategyId: string | null; focus: string;
  nextFocus: string; carryForward: 'REPEAT' | 'CHANGE' | 'COLLECT' | null; assessments: Assessment[];
  timezone?: string; savedAt?: string; strategyContext?: { versionId?: string; name: string; entry: string; invalidation: string; noTrade: string }
}
export type SavedReview = { revision: number; data: Partial<SessionReview> }
export const emptyReview: SessionReview = { state: 'PREPARE', instruments: '', strategyId: null, focus: '', nextFocus: '', carryForward: null, assessments: [] }
export const getSessionReview = (accountId: string, date: string, session = 'DAY') => apiGet<SavedReview>(`/today/reviews/${accountId}/${date}?session=${session}`)
export const saveSessionReview = (accountId: string, date: string, revision: number, data: SessionReview, session = 'DAY') => apiPut<SavedReview>(`/today/reviews/${accountId}/${date}?session=${session}`, { ...data, revision })

export const getSessionReviewHistory = (accountId: string, date: string, session = 'DAY') => apiGet<SavedReview[]>(`/today/reviews/${accountId}/${date}/history?session=${session}`)
