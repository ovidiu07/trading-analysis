# TradeJAudit design system

## Product principles

TradeJAudit is a data-dense trading journal, not a terminal skin. The interface should make the next action obvious, keep financial context easy to scan, and remain calm during active trading. Color is semantic and never the only cue.

The system builds on MUI and Emotion. Do not introduce a second styling framework or page-local color system.

## Sources of truth

- Semantic values: `frontend/src/theme/tokens.ts`
- MUI theme and global component behavior: `frontend/src/theme/theme.ts`
- Theme persistence and system preference: `frontend/src/themeMode.tsx`
- Shared primitives: `frontend/src/components/ui/designSystem.tsx`
- Route context: `frontend/src/config/routeMeta.ts`
- English and Romanian copy: `frontend/src/i18n/en.json` and `frontend/src/i18n/ro.json`
- Locale-aware formatting: `frontend/src/utils/format.ts`

## Typography

The primary UI stack is Manrope, Plus Jakarta Sans, Inter, Segoe UI, then system sans fallbacks. This keeps the application professional and readable without making remote font delivery a runtime dependency. If a hosted font is added later, prefer an Inter variable WOFF2 with `font-display: swap` and preload only the normal upright family.

Use the theme heading hierarchy instead of custom font sizes. Page context is `h1`, sections use `h2`, and nested cards use `h3` or a MUI subtitle. Avoid weights above 750.

Financial values use `var(--app-font-mono)` through `.metric-value` or `FinancialValue`. The fallback stack is JetBrains Mono, IBM Plex Mono, SFMono-Regular, Menlo, and Consolas. It enables tabular numerals so changing values remain aligned.

## Semantic colors

Use theme paths, never literal hex colors in feature components:

- Surfaces: `background.default`, `background.paper`, and tokenized muted/elevated surfaces.
- Text: `text.primary`, `text.secondary`, `text.disabled`.
- Feedback: `success`, `warning`, `error`, and `info`, each with a muted token.
- Charts: `chart.grid`, `chart.axis`, `chart.positive`, `chart.negative`.
- Trading: `trading.profit`, `loss`, `flat`, `long`, `short`, `bullish`, `bearish`, `neutral`, `open`, `closed`, `pending`, and `archived`.

Short is not loss and bearish is not loss. Always pair status color with text or an icon, preferably with `StatusPill`.

Light, dark, and black-shiny modes are intentional palettes. The user can also select system mode. Preferences persist locally and sync to the authenticated profile.

## Spacing, radii, and elevation

MUI spacing uses an 8px base. Compose layouts primarily with 8, 12, 16, 24, and 32px gaps. Shared radii are 8, 14, 18, 24, and pill. Prefer borders and layered surfaces over nested shadows. Use the card elevation only for primary content and the floating elevation for menus/dialogs.

## Layout widths and breakpoints

- Reading: 960px
- Standard: 1360px
- Wide analytics: 1600px
- Desktop sidebar: 286px expanded, 96px collapsed

MUI breakpoints remain the implementation contract: `xs` mobile, `sm` large mobile/small tablet, `md` tablet and shell transition, `lg` desktop, `xl` wide desktop. Do not add arbitrary media queries when a theme breakpoint works.

All page roots require `minWidth: 0`. Mobile pages must not rely on a desktop table. Use cards, expansion, or a priority list below `md`. Validate at 320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920px widths.

## Controls and forms

Buttons use MUI variants consistently:

- contained: primary action
- outlined: secondary action
- text: tertiary action
- error color: destructive action
- IconButton: compact action with an accessible label

Mobile and coarse-pointer targets are at least 44px. Labels stay visible, errors sit next to their field, and optional sections use progressive disclosure. Forms stack at `xs` and never set a fixed minimum width that exceeds the viewport.

## Cards, metrics, and state

Use the shared primitives before creating route-local variants:

- `PageContainer` for reading/standard/wide content widths
- `SectionHeader` for title, description, icon, and action composition
- `MetricCard` for KPI hierarchy
- `StatusPill` for non-color status communication
- `FinancialValue` for unavailable, signed, currency, percent, number, and R values
- `ResponsiveDialog` for focus-managed desktop/mobile overlays
- `EmptyState`, `LoadingState`, `ErrorState`, and `ErrorBanner` for data states

Empty states explain both what is missing and what the user can do next. Use an em dash for unavailable values; do not convert missing financial data to zero.

## Tables and charts

Desktop tables use sticky headers when long, right-aligned numeric columns, tabular numerals, clear actions, and an empty/loading state. Mobile uses feature-priority cards or lists.

Charts must use ResponsiveContainer, theme chart tokens, locale formatters, readable axes/tooltips, a zero reference where meaningful, and a textual title. Embedded TradingView charts preserve the selected symbol, timeframe, configured indicators, and responsive height.

## Dialogs and drawers

MUI dialog defaults provide a scrollable paper, bounded desktop height, sticky action footer, and full-screen mobile presentation. Dialog actions become equal-width 44px controls on mobile. Use `ResponsiveDialog` when a feature needs a standard close control and description. MUI supplies focus trapping, Escape behavior, and restoration.

## Accessibility and motion

- One `h1` comes from the app bar route context; page sections start at `h2`.
- Every icon-only control needs an accessible label.
- Use semantic table/dialog/navigation elements.
- Do not rely on hover for critical actions.
- Focus-visible uses a two-pixel semantic ring.
- Reduced-motion preferences collapse transitions and disable lift transforms.
- Safe-area padding is applied to the application and sticky mobile actions.

## Internationalization

Every static user-facing string belongs in both locale files, including labels, helpers, placeholders, aria text, dialogs, toasts, charts, and empty/error/loading states. User content, symbols, broker/account/strategy names, and protocol enum identifiers remain unchanged.

`useI18n()` supplies `t` for interpolation and `tp` for singular/plural selection. Missing keys fall back to English and emit one development warning. Run `npm run i18n:audit`; use the strict variant when driving remaining legacy hardcoded-copy migration.

Formatting follows `en-US` or `ro-RO`; timezone remains an independent user preference. Use utilities from `utils/format.ts` rather than route-local `Intl` instances.
