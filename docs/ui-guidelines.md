# UI Guidelines

## Design Language
- Theme source of truth: `/Users/ovidiu/Documents/trading-analysis/frontend/src/theme.ts`
- Aesthetic: dark terminal, data-first hierarchy, minimal effects, high contrast surfaces
- Accent color: use `theme.palette.primary.main` for emphasis only
- Positive/negative: reserve `theme.palette.success.main` and `theme.palette.error.main` for P&L/risk states

## Spacing & Radius
- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32`
- Prefer dense layouts in cards and tables (`8-16px` internal spacing)
- Card radius: `14`
- Input/button radius: `10`

## Typography
- Page title (`h1`): `~24-28px`
- Section heading (`h6`): `~16px`
- Label (`subtitle2`): `~12-13px`
- KPI numeric: use `h3` with tabular numbers
- Numeric UI rules:
  - set `font-variant-numeric: tabular-nums`
  - right-align numeric table columns
  - keep sign formatting consistent (`+$...` / `-$...`)

## Reusable Components
- App shell: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/Layout.tsx`
- Top bar: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/layout/TopBar.tsx`
- KPI card: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/dashboard/KPIStatCard.tsx`
- Chart card wrapper: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/dashboard/ChartCard.tsx`
- Recent trades table: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/dashboard/RecentTradesTable.tsx`
- Definitions drawer: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/dashboard/DefinitionsDrawer.tsx`

## Adding New KPI Cards
1. Add KPI metadata in dashboard page (label, numeric value, `formatType`, tooltip text).
2. Render with `KPIStatCard`.
3. Use numeric values instead of pre-formatted strings when possible so locale/currency formatting stays consistent.

## Adding New Charts
1. Wrap each chart in `ChartCard`.
2. Use `DashboardChartTooltip` for consistent date/P&L/trade-count display.
3. Include `ReferenceLine y={0}` for baseline where meaningful.
4. Keep chart heights responsive (`mobile < tablet < desktop`).

## Standard Data States
- Empty: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/ui/EmptyState.tsx`
- Error: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/ui/ErrorState.tsx`
- Loading: `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/ui/LoadingState.tsx`
- Prefer state wrappers inside cards to avoid layout shifts.
