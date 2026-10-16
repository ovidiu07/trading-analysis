# Bulk BE protection fallback verification

15 October 2026, branch `redesign-upgraded-improved`. Local implementation; not deployed. Production workspace and its 1,745 trades were inspected read-only and were not updated.

## Cause and behavior

The production workspace's first trade has entry signal `LONG GER / 2` and exit reason `BE`. Its source file is `Five_Sessions_FVG_Windows_VANTAGE_GER40FT_2026-10-15_be4c2.csv`. The entry signal has no versioned FVG/BE configuration. The prior bulk R calculation rejected the whole update rather than assuming a protection percentage.

The user confirmed BE 60/20. In the fixed outcome model, at planned R:R 1.5, the supplied 20% protected share gives +0.3R for those BE exits. The 60% trigger does not determine the payout. This is a user-supplied model, not measured execution R.

The new bulk field starts blank, appears only when calculating R for BE exits missing versioned settings, requires a valid percentage, and previews the result. Exported FVG settings take priority; disabled or malformed settings remain errors. Planned R:R can still be saved separately with Calculate R unchecked. Cash PnL, raw signals and execution identity are preserved.

## Validation

- 46 focused backend unit tests passed: BacktestingBulkEditTest (18), BacktestingReplayImportTest (23), BacktestingResearchServiceTest (5).
- One authenticated PostgreSQL integration test passed against a newly initialized disposable local PostgreSQL 16 database. It imported a three-trade BE/SL/TP regression fixture, rejected missing protection and 100% protection with no partial edits, saved with 20%, then independently reloaded +0.3R/-1R/+1.5R and total +0.8R. It reconciled unchanged execution fields and currency-based cash metrics.
- 33 focused frontend tests passed across the bulk dialog, export and import review tests. Cases include planned-R:R-only saving, blank protection, invalid range/precision, explicit 0%, source settings, mixed ratios and submitted payload.
- TypeScript and Vite production build passed. Focused ESLint and git diff checks passed. Existing React act warnings in component tests and Vite bundle-size warnings remain.
- Browser checks used the real bulk-dialog component in an isolated local fixture harness with a mock local API. English desktop review displayed 1.5R × 20% = 0.3R and submitted `missingBeProtectedProfitPercent: 20`. Romanian 390px review displayed 1,5R × 20% = 0,3R; blank protection disabled Apply; dialog scroll width and client width were both 326px. This browser fixture check does not prove production persistence; the separate PostgreSQL integration test proves local backend persistence.

Screenshots: `local-desktop-en.png`, `local-mobile-ro.png`. Temporary browser tabs, viewport override, development server and PostgreSQL server were cleaned up after validation.

Backend and frontend must ship together. No migration is needed. No commit, push, deployment or production trade update was performed.
