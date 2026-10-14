# Backtesting selection and workspace clearing

Date: 14 October 2026. Changes are local and have not been deployed.

## Confirmed cause

The deployed `/assets/BacktestingPage-CO3ygI70.js` bundle was read from
tradejaudit.com. It disables Select all, Edit selected, and the bulk-edit submit
button when the editable selection exceeds 500 trades. Therefore 529 trades
disable these controls. This is separate from the 25-row table pagination.

The same cap existed in the local frontend, the bulk request DTO's `@Size`, and
`BacktestingResearchService.updateTrades`. A frontend-only change would still
have failed API validation.

## Implemented solution

- Select all selects every filtered editable trade across pages. Live evidence
  remains excluded from editable selections. Selection uses sets for lookups.
- Removed the 500-trade selection/request cap from both frontend and backend.
  Database ID lookups use batches of at most 500 parameters inside one existing
  transaction. All selected rows are validated before any row is changed; the
  operation remains atomic.
- Added Delete all workspace trades in the Trades tab. Its confirmation names
  the workspace and uses the unfiltered total, independent of page/selection.
  It remains available when filters return zero rows but the workspace is not
  empty. Typed DELETE / ȘTERGE is required. Pending requests disable submission
  and dismissal; failures keep the dialog open.
- Added owner-authenticated `DELETE /api/backtesting/workspaces/{workspaceId}/trades`.
  It atomically unlinks retained screenshots, excludes linked research evidence,
  deletes this user's saved backtesting/replay rows from this workspace, and
  resets legacy summary fields to prevent old totals reappearing when empty.
- Keeps the workspace, notes, edge lenses, screenshot records/assets, other
  workspaces, and original live journal trades. Existing exclusions survive
  later syncs; future imports or new live trades can add new rows.
- Invalidates workspace, trade, analytics, screenshot, lens, library, and
  research-inbox queries after success. English and Romanian copy is included.

## Validation

- 16 frontend tests passed across BacktestingPage and BulkTradeEditDialog,
  including a full 529-ID submission, filtered-empty workspace clearing,
  typed confirmation, cancellation, and failed deletion.
- 31 focused backend tests passed: BacktestingBulkEditTest (8),
  BacktestingClearTradesTest (2), LiveTradeEvidenceSyncServiceTest (16), and
  BacktestingReplayFlowIntegrationTest (5).
- All five integration tests ran against a fresh disposable PostgreSQL 16
  database on loopback port 55439. The new flow persisted and bulk-edited 529
  trades; checked 401/foreign-user rejection; cleared the target workspace;
  preserved another workspace, notes, screenshot asset and record; excluded
  its live evidence; and re-imported the original CSV successfully.
- TypeScript, focused ESLint, production frontend build, and `git diff --check`
  passed. The build retained the existing large-chunk warning.
- A read-only local browser fixture rendered the real page/components with
  529 trades. Select all selected all 529 across 22 pages. The confirmation was
  visually checked on desktop and at 390 × 844 in English and Romanian.
  Preview files/server were removed and the temporary browser viewport reset.
- No production trades were modified or removed. Hosted deployment and
  authenticated production mutation validation remain outside this proof.

Focused commands:

```sh
cd frontend
./node_modules/.bin/vitest run src/pages/BacktestingPage.test.tsx src/features/backtesting/BulkTradeEditDialog.test.tsx
./node_modules/.bin/tsc --noEmit
npm run build
```

Backend tests use Java 21 and the opt-in `REPLAY_TEST_DB_URL`,
`REPLAY_TEST_DB_USER`, and optional `REPLAY_TEST_DB_PASSWORD` variables. The
database must be disposable. Run Maven with:

```sh
mvn -q -Dtest=BacktestingBulkEditTest,BacktestingClearTradesTest,LiveTradeEvidenceSyncServiceTest,BacktestingReplayFlowIntegrationTest test
```
