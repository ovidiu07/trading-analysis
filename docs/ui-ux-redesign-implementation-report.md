# TradeJAudit UI/UX, i18n, and mobile redesign report

Date: 2026-07-18

## Outcome

This pass establishes a shared, responsive product UI foundation and migrates the shell plus the most frequently used planning, session, analytics, diagnostics, calendar, settings, and chart surfaces onto it. Existing API calls, query keys, routes, mutations, and domain calculations were preserved.

The initial audit is recorded in `docs/ui-ux-redesign-audit.md`. The maintained design-system contract is in `docs/ui-guidelines.md`.

## Architecture and design system

### Tokens

`frontend/src/theme/tokens.ts` now owns:

- light and dark surfaces, including elevated and muted layers;
- primary, secondary, text, border, chart, and feedback colors;
- trading semantics for profit, loss, flat, long, short, bullish, bearish, open, closed, pending, and archived states;
- typography, spacing, radius, elevation, layout widths, sidebar dimensions, motion, and the 44 px touch-target baseline.

The long/short colors are intentionally distinct from the generic profit/loss colors. Direction and outcome must not be communicated by color alone.

### Theme behavior

`frontend/src/theme/theme.ts` exposes the trading palette through MUI theme typing and standardizes:

- responsive 44 px touch targets;
- reduced-motion behavior;
- safe-area handling;
- mobile full-height dialogs;
- scrollable dialog content and sticky action bars;
- consistent desktop dialog height, title, content, and action spacing.

### Reusable primitives

`frontend/src/components/ui/designSystem.tsx` adds:

- `PageContainer`
- `SectionHeader`
- `MetricCard`
- `StatusPill`
- `FinancialValue`
- `ResponsiveDialog`

These primitives centralize responsive spacing, financial-value semantics, status presentation, and overlay behavior without changing page business logic.

## Responsive shell

The main application shell now uses a 1,600 px maximum content width, a 286 px expanded sidebar, a 96 px collapsed sidebar, and responsive page gutters. The top bar owns the single page-level `h1`; page content should start at `h2` or lower.

Mobile behavior includes:

- persistent page identity in the top bar;
- full-width content and overlays;
- safe-area-aware sticky actions;
- no page-level horizontal overflow;
- 44 px minimum button and interactive target height;
- compact navigation while preserving accessible labels.

## Page and workflow migration

### Session

- Removed the duplicate page heading.
- Localized plan tabs, plan fields, summaries, chart states, errors, save states, upload actions, and screenshot actions.
- Preserved the existing plan, setup, chart, and persistence behavior.
- Localized plan-image actions and live-chart fallbacks.

### Today, Analytics, and Diagnostics

- Localized signal-intelligence cards and dynamic recommendation summaries.
- Localized the live diagnostics filters, KPIs, chart headings, empty states, tables, and recommendation content.
- Moved chart colors to theme tokens and retained fallbacks for isolated/test themes.

### Calendar and Settings

- Localized plan cards, plan removal confirmation, plan-image counts, and plan accessibility labels.
- Localized TradingView webhook and chart-study settings, feedback, and errors.

### Charts and error handling

- Localized replay-candlestick chart accessibility text.
- Localized the application error boundary while keeping the class boundary internally.
- Applied semantic chart colors and ensured charts retain non-zero mobile sizing.

## Internationalization

The local i18n provider continues to use namespaced JSON resources and now adds:

- `Intl.PluralRules`-based singular/plural selection through `tp`;
- English fallback for missing Romanian values;
- development-only, de-duplicated missing-key warnings;
- URL, stored preference, and browser-language selection;
- `document.documentElement.lang` synchronization.

Translation coverage at the end of this pass:

- English leaf keys: 2,450
- Romanian leaf keys: 2,450
- missing Romanian keys: 0
- missing English keys: 0

`npm run i18n:audit` verifies parity and reports likely hardcoded user-facing JSX. `npm run i18n:audit:strict` is available as a future hard gate.

## Breakpoints

The implementation follows the existing MUI breakpoint contract:

- `xs`: 0-599 px — phone layout, full-screen dialogs, single-column stacking
- `sm`: 600-899 px — large phone/small tablet layout
- `md`: 900-1,199 px — desktop shell and multi-column layouts begin
- `lg`: 1,200-1,535 px — standard desktop workspace
- `xl`: 1,536 px and above — wide workspace constrained by content tokens

Browser validation covered 390 x 844 and 1,440 x 900.

## Validation

Run from `frontend/`:

| Check | Result |
| --- | --- |
| `npm test -- --run --maxWorkers=1 --minWorkers=1` | 42 files passed; 171 tests passed; 10 skipped |
| `npm run build` | Passed; 2,850 modules transformed |
| `npm run lint` | Passed with 0 errors and 31 pre-existing hook warnings |
| `npm run i18n:audit` | 2,450/2,450 keys; zero parity gaps; 518 hardcoded-string candidates |
| Browser, 390 x 844 | No horizontal overflow; one `h1`; Romanian rendered; 44 px button targets |
| Browser, 1,440 x 900 | No horizontal overflow; one `h1`; responsive two-column login layout |

One parallel full-suite run hit the existing 5-second timeout in a heavy mobile trade-dialog test under worker contention. The same test passed in isolation, and the full suite passed with one worker.

## Modified implementation areas

- `frontend/src/theme/tokens.ts`
- `frontend/src/theme/theme.ts`
- `frontend/src/components/ui/designSystem.tsx`
- `frontend/src/components/ui/AppErrorBoundary.tsx`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/layout/SideNav.tsx`
- `frontend/src/layout/TopBar.tsx`
- `frontend/src/i18n/index.tsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/ro.json`
- `frontend/src/pages/TodayPage.tsx`
- `frontend/src/pages/SessionPage.tsx`
- `frontend/src/pages/CalendarPage.tsx`
- `frontend/src/pages/AnalyticsPage.tsx`
- `frontend/src/pages/DiagnosticsPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/session/PlanImagesSection.tsx`
- `frontend/src/components/charts/ReplayCandlestickChart.tsx`
- related focused tests and i18n audit tooling

## Remaining issues and recommended next pass

The redesign foundation and migrated workflows are production-ready, but the repository is not yet at literal 100% source localization. The audit still reports 518 candidates. Most are concentrated in two large legacy research surfaces:

1. `frontend/src/features/backtest/BacktestLabWizard.tsx`
2. `frontend/src/pages/BacktestingPage.tsx`

Those files should be migrated as a dedicated follow-up because they contain hundreds of interdependent labels, presets, validation messages, table columns, and domain-specific explanations. Translating them mechanically in this pass would create a high risk of changing research semantics or test expectations.

Other known non-blocking debt:

- 31 existing `react-hooks/exhaustive-deps` lint warnings;
- the main application bundle still triggers Vite's >500 kB chunk warning;
- authenticated end-to-end visual QA requires a dedicated local test account or seeded browser session;
- the hardcoded-string audit is heuristic and should be refined before enabling strict mode in CI.
