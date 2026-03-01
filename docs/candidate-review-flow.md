# Candidate Review Flow

## Why Candidate-First
Trust is built by letting traders inspect what the engine saw before treating everything as final trades.

## Domain Model
Primary entities:
- `BacktestSetup` (candidate core)
- `BacktestCandidateReview` (review audit trail)
- `BacktestTrade` (converted trade when filled)

Key candidate fields on `BacktestSetup`:
- `templateKey`
- `candidateState`
- `qualityScore`
- `qualityLabel`
- `storySummary`
- `convertedTradeId`
- `evidenceJson`

## Candidate States
Supported states:
- `DETECTED`
- `QUALIFIED`
- `REJECTED_BY_RULE`
- `EXPIRED`
- `ACCEPTED_BY_USER`
- `REJECTED_BY_USER`
- `CONVERTED_TO_TRADE`

State mapping currently implemented:
- filled trades -> `CONVERTED_TO_TRADE`
- no-fill -> `EXPIRED`
- review accept/reject -> `ACCEPTED_BY_USER` / `REJECTED_BY_USER` (or keep `CONVERTED_TO_TRADE` when already converted)

## API
- List run candidates:
- `GET /api/backtest/runs/{runId}/candidates`
- Review candidate:
- `PATCH /api/backtest/candidates/{candidateId}/review`
- body: `{ "decision": "ACCEPT"|"REJECT", "note": "..." }`

## UI Behavior
Strategy Studio -> Candidates tab:
- card per candidate with status/story/reasons
- accept/reject actions persist review
- inspect opens trade storyline (or candidate diagnostics if no converted trade)
- refresh/rerun actions keep feedback loop tight

## Persistence / Migration
Added in `V38__backtest_candidates_and_playbooks.sql`:
- new columns on `backtest_setups`
- new table `backtest_candidate_reviews`

## Test Coverage
- backend: `BacktestLabServiceTest.candidateReviewAndPlaybookPromotionPersistDomainConcepts`
- frontend: candidate review action assertions in `BacktestLabWizard.test.tsx`
