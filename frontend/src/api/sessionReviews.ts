import { apiGet, apiPut } from './client'
export type ReviewState = 'PREPARE' | 'TRADE' | 'REVIEW' | 'COMPLETE'
export type Assessment = { tradeId: string; decision: 'FOLLOWED' | 'DEVIATED' | 'CANNOT_ASSESS'; note: string }
export type SessionReview = {
  state: ReviewState; instruments: string; strategyId: string | null; focus: string;
  nextFocus: string; carryForward: 'REPEAT' | 'CHANGE' | 'COLLECT' | null; assessments: Assessment[];
  timezone?: string; savedAt?: string; strategyContext?: { name: string; entry: string; invalidation: string; noTrade: string }
}
export type SavedReview = { revision: number; data: Partial<SessionReview> }
export const emptyReview: SessionReview = { state: 'PREPARE', instruments: '', strategyId: null, focus: '', nextFocus: '', carryForward: null, assessments: [] }
export const getSessionReview = (accountId: string, date: string) => apiGet<SavedReview>(`/today/reviews/${accountId}/${date}`)
export const saveSessionReview = (accountId: string, date: string, revision: number, data: SessionReview) => apiPut<SavedReview>(`/today/reviews/${accountId}/${date}`, { ...data, revision })

export const getSessionReviewHistory = (accountId: string, date: string) => apiGet<SavedReview[]>(`/today/reviews/${accountId}/${date}/history`)
