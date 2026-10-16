# Advanced Strategy Studio — local validation

Date: 16 October 2026. Checkout: `redesign-upgraded-improved`.

## Evidence boundaries

The feature lives in the existing `/strategies` route. Authenticated browser checks use the actual local React application, Spring Boot API and a separate PostgreSQL database, `codex_strategy_studio_20261016`. Browser examples and six research trades are explicitly synthetic QA fixtures. Existing user and production data were not changed.

Image integration tests exercise the existing upload validation, ownership, ORM links and checkpoint references with a substituted object-storage interface. This does not prove access to the production S3 bucket.

## Automated checks

- Full frontend Vitest suite: 503 passed, 10 existing skipped tests, 90 files.
- Focused studio frontend suite: 26 cases covered in the full run, including queued autosaves, edits during a save, failed saves, recovery, stale revisions, parameter constraints, notebook tables, presets, checklists and navigation while an image upload is pending.
- Backend selected suite: 112 passed, zero failures/errors/skips. Includes 15 definition-validator cases, nine authenticated Strategy Studio/PostgreSQL cases and ten existing replay/PostgreSQL integration cases, together with existing strategy, research, bulk edit, replay import, clear-trades, preparation and asset tests.
- Markdown export was checked again after preserving list/paragraph boundaries: 11 model/export tests passed.
- TypeScript and production Vite build: passed.
- ESLint: zero errors; 15 existing warnings outside the new studio files.
- `git diff --check`: passed.
- V79 applied through Flyway on the isolated PostgreSQL database; Hibernate schema validation succeeded.

Backend classes executed: `StrategyServiceTest`, `StudioDefinitionValidatorTest`, `StrategyStudioIntegrationTest`, `BacktestingResearchServiceTest`, `BacktestingServiceTest`, `BacktestingBulkEditTest`, `BacktestingReplayImportTest`, `BacktestingClearTradesTest`, `SessionReviewServiceTest`, `BacktestingReplayFlowIntegrationTest`, `AssetServiceTest`.

Integration tests verify authorization across all new private operations; save/reload; unsafe HTML sanitization; bounds/step constraints; immutable checklist executions; checkpoint creation and append-only restoration; export/import/duplication/archive; explicit replay strategy-version linking without changing signals, currencies, prices or P&L; image ownership; concurrent checkpoint serialization; unsupported import fields; and rejection of a stale checkpoint association for a diverged draft.

## Authenticated browser checks

- 1440 × 1000: native sidebar/workspace, notebook, parameter search, preset comparison and version history inspected.
- 390 × 844: notebook controls, typography, wrapping and saved state inspected; no horizontal document overflow.
- 320 × 800: compact parameter editor inspected; no horizontal document overflow. The vertical scrollbar accounts for the difference between the configured viewport and client width.
- Changed a notebook table header, switched tabs, reloaded and verified persistence.
- Changed minimum FVG to 0.07%, saved a named preset, changed the current value to 0.08%, and inspected the comparison.
- Created a named checkpoint; restored the older configuration to a new checkpoint; verified the later checkpoint still existed; restored it again without deleting history.
- Opened two tabs at one revision, saved in the first and attempted a stale save in the second. The API rejected it; the UI retained the draft and displayed a field comparison with the newer server copy. Keeping the server copy preserved the first tab's changes.
- Opened the integrated research view and verified the six stored synthetic research records, performance cards, existing charts and linked workspace.

## Screenshots

- [Desktop overview](desktop-overview.jpg)
- [Desktop notebook](desktop-notebook.jpg)
- [Desktop parameter/preset comparison](desktop-parameters.jpg)
- [Mobile notebook](mobile-notebook.jpg)
- [Real two-tab conflict review](editing-conflict.jpg)

## Release boundary

No production deployment or production migration was performed. Backend and frontend must ship together; normal Flyway startup applies V79. Existing S3 configuration is required for real uploads. Custom strategy rules remain structured documentation/manual checks because the existing engine does not execute arbitrary user-defined rule trees. Exports contain private asset references, not image binaries or historical trade datasets.
