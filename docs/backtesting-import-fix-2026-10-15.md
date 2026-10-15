# Backtesting CSV import correction — 15 October 2026

The supplied CSV imports without the 255-character signal rejection. Entry and exit signals are stored as PostgreSQL TEXT and preserved in full. The FVG parser reads its own versioned section while retaining the appended FVGAGEv1 section in the raw entry signal.

The workspace instrument is optional in create/edit forms, API requests, persistence, display fallbacks and export names. CSV instruments do not need to match the workspace instrument, and import review no longer displays an instrument mismatch warning. Imported trades retain PEPPERSTONE:GER40F. A blank workspace instrument does not restrict live-evidence matching; linked strategy and configured session/timeframe checks remain active.

## Exact source

- File: `/Users/ovidiu/Downloads/Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_38b5c.csv`
- Regression fixture: `backend/src/test/resources/backtesting/tradingview-strategy-ger40f-long-signals.csv`
- Byte-for-byte match verified with `cmp`.
- SHA-256: `d025742f0c3bd575fcd61ffe04a926828ce6bbb83e7fc3c0ab54939c3da5bf37`
- 1,062 execution rows; 531 closed trades; 260 wins; 271 losses.
- All 531 entry signals exceed 255 characters; longest entry signal: 290 characters.
- Source net PnL: USD 5,834.85. Execution-price currency: EUR.

## Verification

- 57 focused backend tests passed, including seven authenticated PostgreSQL integration tests. Covered parser validation, long entry and exit signals, FVG section boundaries and protected-profit parsing, workspace API creation/update without an instrument, live compatibility, exact-file preview/save/reload, source-field reconciliation, duplicate protection, ownership and existing research flows.
- 55 focused frontend tests passed across eight files. Covered workspace create/edit with a blank instrument, Romanian labels, import preview/save with blank and mismatched workspace instruments, currency display, existing export/page flows and i18n coverage.
- TypeScript, ESLint for changed frontend code, Vite production build and `git diff --check` passed. The build retains its existing large-chunk advisory.
- Migration V77 applied successfully to a new isolated database, with Hibernate schema validation passing. A separate transactional upgrade probe retained existing 255-character signals and GER40F workspace metadata, normalized an empty workspace instrument to NULL, and accepted 2,000-/3,000-character entry/exit signals and a NULL workspace instrument. The probe rolled back.
- Real local browser checks passed at 1440px English/light, 390px Romanian/light and 375px English/dark. Each created its workspace through the UI, previewed/imported the exact CSV, reloaded all 531 trades, reconciled all source execution fields and full signals, checked the full signal in trade details, and detected all 531 reimport duplicates. Two workspaces started with no instrument; the third used GER40F. All three allowed clearing/saving the workspace instrument after import. No page errors or horizontal page/dialog overflow were detected in the tested flows.

Raw browser results and screenshots: `output/backtesting-import-fix-2026-10-15/`. Backend integration database: `backtesting_import_fix_20261015`, a disposable local PostgreSQL database with fixture users, removed after verification along with the temporary app servers. No production account, workspace or database was modified.

## Delivery boundary

Changes are local on `redesign-upgraded-improved`; no commit, push or deployment was performed. Deploy the backend, frontend and `V77__backtesting_full_signals_optional_workspace_instrument.sql` together. The original CSV needs no modification. Unrelated pre-existing Pine, research and environment changes were preserved.
