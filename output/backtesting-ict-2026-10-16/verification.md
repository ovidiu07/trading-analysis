# ICT Backtesting metadata validation — 16 October 2026

Implementation branch: `redesign-upgraded-improved`. Local changes only; no commit, push, hosted deployment or production data mutation.

## Automated checks

- **Backend: 108 tests passed, 0 failures, 0 errors, 0 skipped.** Suites: IctMetadataTest (5), BacktestingResearchServiceTest (5), BacktestingReplayImportTest (25), BacktestingReplayFlowIntegrationTest (10), BacktestingSessionClassifierTest (15), LiveTradeEvidenceSyncServiceTest (17), BacktestingServiceTest (5), BacktestingBulkEditTest (18), BacktestingClearTradesTest (2), BacktestingWorkspaceCompatibilityServiceTest (6).
- The ten authenticated HTTP integration tests ran against a disposable local PostgreSQL 16 UTF-8 database with Flyway migrations through V78 and Hibernate schema validation. They cover complete/partial/no metadata, manual and imported trades, stored reload, explicit clearing, optional numeric validation, account ownership, execution preservation and repeat imports.
- **Frontend: 107 tests passed across 14 files.** Command: `npm test -- --run --silent src/features/backtesting src/pages/BacktestingPage.test.tsx` from frontend.
- **Production build/type-check: passed.** Command: `npm run build` (runs TypeScript and Vite). Vite retains the existing large-chunk warning.
- **Lint: passed, 0 errors, 17 warnings in unrelated files.** No lint warnings in the modified Backtesting files.
- **Whitespace validation: passed.** `git diff --check`.

## Browser checks

Authenticated browser checks used the real local backend and a disposable PostgreSQL actor/workspace, plus the repository's 25-trade native TradingView Replay fixture. No API responses were mocked.

- Edited imported ICT annotations through the existing trade form, saved, reloaded the page, and confirmed Setup Type, FVG percent and age were restored.
- Compared entry/exit prices, quantity, net P&L, commission, dates/times, direction and import fingerprint with the source import response; all stayed unchanged.
- Verified two-column controls at 1440 px and one-column controls at 390 px.
- Verified no horizontal overflow in the mobile trade dialog and persistent expandable-field values.
- Opened the same trade details with numeric units and saved metadata.
- Rendered the Romanian edit workflow and verified no browser page errors.

Screenshots: desktop-edit.png, mobile-edit.png, mobile-details.png, mobile-ro-edit.png. Machine-readable results: browser-results.json. Browser test identities refer only to the disposable local database.

## Behavior boundaries

- Native replay fingerprinting remains unchanged. Reimport preservation and intentional clearing are proven by authenticated persistence tests, including zero duplicate insertion.
- Generic CSV uses explicit source IDs when available, otherwise the available execution tuple. Identical tuples without source IDs are indistinguishable and are treated as duplicates.
- Strategy metadata remains optional and per trade. Current market conditions are never used to reclassify historical context. No FVG age, retest, sweep or category is fabricated from prices alone.
- V78, backend and frontend must be released together. Production migration/deployment was not performed.

The field-by-field inventory and semantics are documented in docs/backtesting-ict-metadata.md.
