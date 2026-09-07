# Session briefings verification — local, 2026-09-06 to 2026-09-07

## Automated checks

- Frontend: **50 tests passed**, 5 files: context (20), structured model (16), widget lifecycle (5), briefing selection/races (4), Today workflow regression (5).
- Backend: **42 tests passed**, 4 classes: BriefingValidatorTest (10), SessionBriefingSelectionTest (17), BriefingMathTest (4 existing), SessionReviewServiceTest (11 existing). No failures/errors/skips in these classes.
- Authenticated PostgreSQL-backed HTTP integration: **53 assertions passed** against the latest backend on localhost:8082 and isolated `tradevault_editorial_empty_20260906`. See api-checks.json and backend/scripts/verify_editorial_local.py. These are real HTTP/database checks, not mocked browser responses.
- Frontend production build/typecheck passed. Targeted ESLint passed with no warnings. git diff --check passed.
- Build retains the existing large-chunk advisory; tests emit React Router v7 future-flag notices.

## Database evidence

Original local `tradevault`: Flyway version 59, left unchanged. Isolated QA clone upgraded from 66 to 67. Separate empty database applied **67 SQL migrations**, plus Flyway's schema-creation history entry. Final clean fixture has 5 immutable publication revisions and 14 audit actions. Flyway reported: `Successfully applied 67 migrations to schema "tradevault", now at version v67`.

Direct database attempts to UPDATE one publication revision and one audit action were both rejected by the immutable trigger. The statements ran in caught PL/pgSQL subtransactions and did not change their rows. Applied migration files were not edited.

## Authenticated local browser evidence

Used separate synthetic ADMIN and ordinary-user sessions against the actual local application/API. No market claims or real orders were entered.

- Admin create → paste JSON → review import → preview → publish; the ordinary user subsequently read that publication.
- Today four preparation steps → observation mode, private thesis/bias/chart plan and explicit Ready confirmations → Trade → synthetic OPEN trade → linked trade review showing the frozen publication/composition.
- Refresh retained preparation. After token expiry during development, reauthentication and the explicit retained-draft recovery flow restored local edits.
- EN and RO; missing Romanian editorial translation explicitly identifies English content. Light and dark themes checked.
- Actual widths 360, 390, 768, 1280 and 1440: no horizontal page scrolling. See admin-widths.json and final-frame-dimensions.json. Sidebar changes and preparation-step changes checked.
- Native supporting-details summary toggles with Enter; Tab advances to the next summary, whose computed visible focus outline is a 2px blue solid outline.
- Actual Bucharest midnight rollover offered missing-next-context information while preserving the existing capture. Deterministic threshold/DST cases are unit tests, not claims of waiting for every real clock transition.
- Actual TradingView chart rendering verified for Brent TVC:UKOIL, WTI TVC:USOIL and DAX XETR:DAX. DXY, US/DE 2Y/10Y yields, NDX and ES displayed TradingView-only restrictions; the final UI renders a clear direct-link fallback for those symbols. Symbol screenshots document original vendor outcomes. monitor-final.png documents the final isolated iframe rendering; restricted-fallback-final.png documents the final restriction state.
- Actual final nested iframe heights were 326px inside a 358px outer iframe. Widths at the five target viewports were 274, 304, 666, 1074 and 1234px with the sidebar collapsed.
- Private-field changes retain widget identity; automated lifecycle tests cover this. Step/theme changes intentionally replace its document. The isolated-document fix removed the previously observed asynchronous vendor null-parent error on React step teardown.

## Console/network findings and limits

During development, logs included an old vendor null-parent teardown error (fixed by iframe document isolation), transient Vite/i18n hot-reload errors (cleared after reload), and expired-auth responses (reauthenticated and recovered). External TradingView telemetry requests also failed. These are not described as a globally error-free browser session. Final supported-chart rendering was checked after the lifecycle fix.

No hosted or production deployment/browser checks were run. No broad backend/Testcontainers suite or exhaustive assistive-technology audit was run. The browser flow used observation mode; personal strategy version behavior is covered by existing service tests and preserved code, not a new full browser strategy-adoption tour. Not every theme/locale/width permutation was tested as a Cartesian matrix.

ATH distance and application-level day-range metrics are deliberately unavailable: no authorized complete compatible series or verified native metric is available. Tests reject unsupported imports; they do not pretend to verify absent ATH/day-range algorithms. Yield snapshot differences use basis points, not an inferred daily yield range. Restricted yield embeds were not claimed to render yields successfully; instrument identity is supported by official TradingView symbol pages. No widget price values were scraped, OCR-read, intercepted or saved into historical context.

See docs/session-briefings.md and docs/tradingview-market-monitor.md for operational instructions, selection cutoffs and per-instrument limitations.

## Reproduction

Frontend from `frontend/`:

```sh
npx vitest run src/features/preparation/context.test.ts src/features/briefings/model.test.ts src/components/charts/TradingViewWidget.test.tsx src/features/preparation/BriefingPanel.test.tsx src/pages/TodayPage.removePlan.test.tsx
npm run build
npx eslint src/features/briefings src/features/preparation/BriefingPanel.tsx src/features/preparation/PrepareSteps.tsx src/pages/admin/AdminSessionBriefingsPage.tsx src/components/charts/TradingViewWidget.tsx
```

Backend from `backend/`, using Java 21:

```sh
mvn -Dtest=BriefingValidatorTest,SessionBriefingSelectionTest,BriefingMathTest,SessionReviewServiceTest test
```

The HTTP harness creates synthetic records and needs a fresh isolated migrated database with its two synthetic users. From the repository root, point EDITORIAL_QA_API at that local backend and run `python3 backend/scripts/verify_editorial_local.py`. Do not rerun against the same fixture date or a non-QA database; canonical date/session uniqueness deliberately prevents duplicate identities. See the harness for fixtures and checks.
