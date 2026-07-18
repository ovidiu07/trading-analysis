# Backtesting Evidence Engine Architecture Audit

## Scope

This audit covers the checked-out Backtesting research module before the Evidence Engine redesign:

- `frontend/src/pages/BacktestingPage.tsx`
- `frontend/src/api/backtesting.ts`
- `backend/src/main/java/com/tradevault/controller/BacktestingController.java`
- `backend/src/main/java/com/tradevault/service/BacktestingService.java`
- `backend/src/main/java/com/tradevault/service/BacktestingResearchService.java`
- Backtesting workspace, trade, screenshot, and Edge Lens entities/repositories
- Canonical live trade creation, update, import, and delete paths in `TradeService`
- Flyway migrations `V49`, `V52`, and `V53`
- English/Romanian resources and Backtesting page tests

This research module is separate from the candle-replay Backtest Lab embedded in Session Mode. The Backtest Lab produces deterministic simulation runs; `/backtesting` stores user-curated strategy evidence.

## Existing architecture

The public route is a single `/backtesting` route. `BacktestingPage.tsx` owns library selection, workspace editing, filters, metrics, trades, CSV import, Edge Lenses, screenshots, notes, dialogs, and responsive rendering in one 2,265-line component. It automatically selects the first workspace, so the library and workspace detail are displayed at the same time.

The backend stores:

- `backtesting_workspaces`: workspace identity, optional strategy reference, timeframe metadata, legacy aggregate counters, and research notes.
- `backtesting_trades`: independent manual/imported research rows used by analytics.
- `backtesting_screenshots`: workspace evidence with an optional research-trade link.
- `backtesting_edge_lenses`: saved filter definitions and metric snapshots.

`BacktestingResearchService` calculates aggregate and breakdown metrics from `backtesting_trades`. `BacktestingService` falls back to legacy workspace counters only when no structured research trades exist.

Canonical live trades are stored in `trades` and are created, updated, imported, reopened, or deleted through `TradeService`. No current code path links those records to a Backtesting workspace or recalculates Backtesting analytics after live trade changes.

## Main problems

1. Manual/imported research evidence and live execution are disconnected, so the product cannot verify whether live execution confirms historical results.
2. Copying a live trade into `backtesting_trades` would create competing sources of truth and duplicate-edit risk; an idempotent link is required.
3. The UI combines library discovery and detailed research work, causing deep filters and workspace controls to compete for attention.
4. `BacktestingPage.tsx` contains many hardcoded English labels, errors, confirmations, accessibility labels, and empty states. The existing `backtesting` translation namespace covers only strategy/FVG fields.
5. Existing sample labels are based only on count and use inconsistent thresholds. Sample size does not account for expectancy, drawdown, recent stability, manual/live divergence, or missing classifications.
6. Source labels currently distinguish `MANUAL`, `IMPORT`, and `SCREENSHOT`, but not linked live evidence.
7. Mobile adaptations exist for selected tables/cards, but the page still exposes too many controls at once and relies on scrollable tabs.

## Refactor boundaries

- Preserve all existing workspace, research trade, screenshot, note, Edge Lens, strategy reference, and legacy aggregate columns.
- Add an evidence-link table instead of replacing or rewriting old research rows.
- Keep canonical live trades authoritative; store only matching/audit snapshots and research-only classification on the evidence link.
- Trigger synchronization from the existing transactional live-trade service so create/update/import behavior is deterministic and retry-safe.
- Keep analytics recalculation request-driven and limited to affected workspaces; do not add distributed infrastructure.
- Keep `/backtesting` for the library and add `/backtesting/:workspaceId` for a focused workspace.

## Target information architecture

### Library

- Header and primary actions
- Research summary by evidence source
- Search and shallow workspace filters
- Workspace cards with evidence status and source counts
- Research Inbox for unlinked, ambiguous, incomplete, excluded, or failed live evidence

### Workspace detail

- Workspace header and matching configuration
- Overview
- Trades
- Edge analysis
- Evidence
- Notes

The workspace detail prioritizes evidence quality, manual/imported/live comparison, recent live regression, and unresolved classification work. Screenshot upload remains contextual to a workspace or trade.

## Data and synchronization direction

The additive `backtest_evidence_links` model owns the relationship between a canonical live trade and a workspace. A unique live-trade key makes synchronization idempotent. Links can remain unassigned for Research Inbox states. Closed trades with a realized R multiple can enter analytics; reopened, deleted, excluded, ambiguous, and unlinked trades remain visible but excluded from realized metrics.

Matching uses stable `strategy_id` first, then normalized instrument, optional session, and optional timeframe according to each workspace's auto-import mode. Multiple eligible workspaces produce `NEEDS_REVIEW`; zero matches produce `NOT_LINKED`; neither case silently creates or duplicates a workspace.
