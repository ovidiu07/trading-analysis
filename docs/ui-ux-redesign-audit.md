# TradeJAudit UI/UX redesign audit

Date: 2026-07-18

## Executive summary

TradeJAudit already has the beginnings of a coherent MUI-based product system: a centralized theme, three persisted theme modes, a responsive application shell, route-level lazy loading, locale-aware financial formatters, and mobile alternatives for several large data views. The redesign should extend that architecture instead of introducing another component framework.

The largest remaining risks are inconsistent shared primitives, duplicated page headings, route-local hardcoded English, uneven mobile dialog behavior, and page-specific visual rules in the largest feature screens. These issues are most visible in Session, Backtesting, Diagnostics, Calendar, Analytics, Settings, and admin content tools.

## Current architecture

- Framework: React 18, TypeScript, Vite, React Router, TanStack Query.
- UI: MUI 5, MUI icons, MUI Data Grid, Emotion `sx` styling.
- Charts: Recharts plus an embedded TradingView widget.
- Forms: React Hook Form and Zod where feature flows have adopted them; older screens still use local state.
- Theme: `frontend/src/theme/tokens.ts` feeds `frontend/src/theme/theme.ts`; `ThemeModeProvider` persists system, light, dark, and black-shiny preferences and syncs authenticated preferences.
- i18n: a local English/Romanian provider with interpolation, fallback to English, URL/browser/storage language detection, and `html[lang]` updates.
- Shell: responsive permanent/collapsible desktop sidebar, temporary mobile drawer, sticky top bar, route metadata, shared content container, and footer.
- Loading: major routes are lazy-loaded. Heavy feature code remains isolated at route boundaries.

## Verified strengths

- English and Romanian resources have identical key sets: 2,240 leaf keys in each locale, with no missing keys in either direction.
- Theme tokens already cover surfaces, text, borders, brand, feedback, chart colors, interaction states, elevation, and radii.
- Theme preference, language preference, and system color-scheme handling persist.
- Financial formatting returns an em dash for unavailable values and uses the selected locale.
- Trades, Backtesting, Calendar, Notebook, Analytics, admin pages, and recent-trades views contain responsive branches or mobile-specific representations.
- Desktop navigation is grouped into Trading, Journal, and System and supports collapse, active state, icons, and tooltips.
- Large routes are lazy-loaded and do not require a router or state-management rewrite.

## Gaps against the redesign brief

### Design system

- Token naming does not yet expose the full semantic vocabulary requested by the brief: elevated/muted surfaces, muted feedback backgrounds, long/short/bullish/bearish/neutral states, motion durations, breakpoints, and layout widths.
- Common UI is incomplete. PageHeader, PageHero, EmptyState, ErrorState, and LoadingState exist, but cards, metrics, section headers, filter bars, status pills, financial values, and responsive overlays still have multiple implementations.
- Two historical TopBar modules remain in the tree; the shell uses `frontend/src/layout/TopBar.tsx`.

### Typography and density

- The active theme uses a professional sans stack and a mono numeric class, but fonts are not documented as a loading/fallback policy.
- Some pages use route-local weights such as 800/850 and page-specific heading scales.
- Several pages repeat the route title inside content even though the top bar already supplies route context.

### i18n

- Locale files are structurally complete, but structural parity is not the same as source coverage.
- Obvious English literals remain in user-facing JSX, labels, placeholders, aria labels, dialogs, chart/table labels, and empty states.
- Highest-priority hardcoded areas: Session, Backtesting, Diagnostics, signal-intelligence panels in Today/Analytics/Settings, Calendar plan flows, AppErrorBoundary, and screenshot navigation.
- The current translator falls back safely but has no development warning or automated source audit.
- Plural selection is not a first-class helper; existing copy generally interpolates already formatted counts.

### Mobile and responsive behavior

- The shell prevents page-level horizontal overflow and uses a drawer at tablet/mobile widths.
- Several feature pages have mobile cards instead of desktop tables.
- Dialogs are adapted individually. A shared full-screen/bottom-sheet mobile overlay contract is missing.
- MUI controls default to 40px; the brief requires a 44px minimum mobile target.
- Some Notebook dialog content uses a fixed `minWidth: 320`, which is unsafe inside a 320px viewport after dialog padding.

### Accessibility

- Focus-visible styling, semantic navigation, labels, tooltips, and button labels are present in the shell.
- The global error boundary is hardcoded and not connected to i18n.
- Reduced-motion support is missing from global interactive transitions.
- Decorative background effects and animated hover lifts are not explicitly disabled under reduced-motion.
- Chart descriptions and consistent non-color status cues are not enforced by a shared chart/status component.

### Charts and tables

- Theme-level table and data-grid styling exists, and several charts use responsive containers.
- Chart color and tooltip usage remains page-specific.
- Backtesting and analytics still include hardcoded chart/table vocabulary and default-locale date formatting.
- Mobile table conversions are implemented per page rather than through a shared responsive data-display contract.

## Migration plan

1. Expand semantic tokens and global MUI behavior, including mobile targets, responsive dialogs, and reduced motion.
2. Add shared page/section/card/metric/status/financial/overlay primitives.
3. Consolidate the shell and remove duplicate page-title presentation.
4. Migrate the highest-use routes first: Today, Session, Trades, Calendar, Dashboard.
5. Migrate remaining routes and remove route-local hardcoded UI strings.
6. Add locale parity and hardcoded-string audit safeguards.
7. Validate unit/component tests, lint, typecheck/build, then visually inspect representative routes in both themes/locales at the required viewport classes.

## Business-logic boundary

This redesign will not alter P&L, risk, R-multiple, analytics, backtesting, ownership, permissions, authentication, database, or timezone semantics. UI integration changes will be limited to presentation, translation lookup, responsive composition, and accessible interaction behavior.
