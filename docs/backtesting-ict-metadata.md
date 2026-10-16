# Backtesting ICT metadata

Implemented in the existing Backtesting research workflow. All annotations describe the primary setup/FVG selected for the individual trade at entry; no current market data is consulted.

## Audit and field reconciliation

The existing research entity (`BacktestingTrade`) uses nullable relational columns, not an extensible metadata JSON object. Manual creation and imported-trade editing share `ManualTradeDialog` and `BacktestingTradeRequest`. TradingView replay imports retain immutable execution fields and use the existing workspace/import-fingerprint unique index. Linked live evidence already has `research_classification` JSON, which is reused for its research-only annotations.

| Requested field | Before this change | Final source of truth |
| --- | --- | --- |
| Setup Type | Missing; `setupName` is a separate user-named setup | New nullable `setupType` |
| Entry Timeframe | Stored, free-text optional UI | Existing `entryTimeframe`; dropdown with historical values retained |
| Session | Stored, overwritten by timestamp classifier on every edit | Existing `session`; explicit per-trade dropdown, clearable |
| Trade Direction | Fully implemented; populated from replay | Existing `direction`; imported execution remains locked |
| Setup Quality | Missing on research trades; live `setupGrade` belongs to canonical live evidence | New nullable `setupQuality`; linked annotations use existing research JSON |
| Entry Confirmation | Missing | New nullable `entryConfirmation` |
| HTF Timeframe | Equivalent existing context timeframe, free-text UI | Existing `contextTimeframe` dropdown |
| HTF Trend | Missing | New nullable `htfTrend` snapshot |
| Direction vs HTF | Missing | Derived on display from saved direction and HTF trend, never stored |
| Market Structure | Missing | New nullable `marketStructure` |
| Price Location | Missing | New nullable `priceLocation` |
| Market Condition | Missing | New nullable `marketCondition` |
| Liquidity Type | Missing; `gapRelationToLiquidity` combines confluence and is not equivalent | New nullable `liquidityType` |
| Liquidity Side | Missing | New nullable `liquiditySide` |
| Sweep Level | Missing | New nullable `sweepLevel` |
| Sweep Confirmation | Missing | New nullable `sweepConfirmation` |
| Structure Confirmation | Missing; FVG confluence is not equivalent | New nullable `structureConfirmation` |
| Displacement | Missing | New nullable `displacement` |
| FVG Direction | Existing `gapType`, absent from current manual UI | Existing `gapType` with bullish/bearish and preserved legacy unknown |
| FVG Timeframe | Existing `gapTimeframe`, absent from current manual UI | Existing `gapTimeframe` dropdown |
| FVG Size (%) | Existing decimal `gapSizePercent`, absent from current manual UI | Existing `NUMERIC(12,6)` column, raw percentage |
| FVG Size (Points) | Existing decimal `gapSizePoints`, absent from current manual UI | Existing `NUMERIC(20,8)` column, price points |
| FVG Age at Entry | Missing | New nullable non-negative integer `fvgAge` |
| FVG Retest | Missing | New nullable `fvgRetest` |
| FVG Entry Location | Missing; existing `gapEntryPositionPercent` is precise direction-relative depth, not a price-zone category | New nullable `fvgEntryLocation`; existing depth stays unchanged |
| FVG Status at Entry | Equivalent existing `gapFillStatus`, absent from current manual UI | Existing `UNFILLED`, `PARTIALLY_FILLED`, `FILLED` shown as Fresh, Partially Mitigated, Fully Mitigated; other historical enum values stay available |
| FVG Sequence | Missing | New nullable `fvgSequence` |

V78 adds seventeen nullable annotation columns and one non-null `ict_metadata_edited` protection flag (default false), plus the non-negative age constraint. It does not rewrite historical categorical values or populate missing annotations. Schema, backend, and frontend must ship together.

## Shared field definitions and validation

`backend/src/main/resources/backtesting/ict-fields.json` is the canonical registry of keys, options, labels (EN/RO), quick-entry fields, units/precision and groups. The frontend uses a checked-in generated copy so its Docker build remains standalone. Run `npm run ict:sync` from `frontend` after changing the canonical file. A frontend test asserts exact equality to prevent drift.

The service validates both full requests and metadata-only patches against that registry. All optional fields can be cleared; explicit `NONE` / `NO_SWEEP` remain distinct from null. Unchanged historical categorical values survive editing verbatim, even if absent from the canonical options. New choices must match the registry. Timeframes beyond the required list remain selectable, and saved custom timeframes remain visible and clearable.

FVG percent is the entered percentage: `0.07` is **0.07%**. Points represent instrument price distance, with no monetary or pip conversion. A legacy `Gap size pips` CSV column produces an import warning and is not treated as price points; historical stored values are left untouched. Age is the number of completed bars on the selected FVG timeframe since confirmation; no additional completed bars means age 0. Percent permits six decimal places, points eight, and age is a non-negative 32-bit integer. Non-finite, negative, fractional-age and out-of-range/precision inputs are rejected; missing values remain null.

FVG entry-location categories use absolute price from gap low to gap high for both bullish and bearish gaps. Boundary means exactly either outer edge; otherwise Lower 25% is (0,25), Middle 50% is [25,75], and Upper 25% is (75,100). Existing direction-relative `gapEntryPositionPercent` is kept separately and is never reinterpreted or used to fabricate a category.

Direction vs HTF is computed by `directionVsHtf`: aligned long/bullish or short/bearish is With Trend, opposite directions are Against Trend, and a saved ranging HTF is Neutral. Missing direction or trend remains unclassified.

## Capture, editing, details and filtering

The existing manual/edit dialog exposes the nine key fields first, then four expandable sections. Desktop uses two columns, mobile one. Searchable select controls support keyboard navigation and explicit clearing. Collapsing sections and changing Setup Type preserve all other draft values.

Context is not inherited from earlier trades automatically. The explicit Copy Context action selects the previous chronological trade within the current workspace and copies only HTF timeframe/trend, structure, condition and session. Values remain editable. It leaves FVG measurements, sweep level, confirmation and all execution data alone.

All trade origins have Details and Edit actions. Details uses the same registry/groups, units and saved values; empty groups have one subtle placeholder. Imported executions preserve their existing editing restrictions. The form uses a dedicated metadata-only save whenever other editable trade fields are unchanged; legacy financial inconsistencies do not prevent annotation enrichment. The dedicated `PATCH /api/backtesting/trades/{id}/ict-metadata` accepts only registry fields; account ownership is checked before mutation, and execution/accounting fields cannot be changed through this route. Linked live evidence stores overrides under `research_classification.ict`, preserving other classification keys and canonical live trades. These overrides survive evidence refresh.

Setup Type, HTF Trend, Liquidity Type and Sweep Level filters extend the existing research-filter system, including the calendar and period export. Exported trade rows include all seventeen new fields. Numerical values remain numeric; no statistical buckets are persisted and no new analytics module is introduced.

## Import and reimport behavior

TradingView native CSV and generic TradeJAudit CSV accept explicit registry keys or English field labels as metadata columns. Values use the same canonical validation; absent columns do not invent context, sweeps or FVG facts. Native entry/exit rows with conflicting explicit metadata are rejected. Existing validated `FVGv1` source parsing remains intact, including complete raw signals.

Native replay identity and duplicate detection are unchanged. Generic CSV rows now also use the existing workspace/import-fingerprint mechanism, using an explicit source trade ID when present, otherwise instrument, entry date/time, direction, result and source R; matching older generic imports without fingerprints are recognized in memory. These generic exports do not provide a stronger execution identity: rows with identical available execution values and no source trade ID are treated as duplicates. Native replay retains its richer price/quantity/exit identity.

Duplicate imports preserve user annotations, including explicitly cleared fields. Once the metadata has been edited, `ict_metadata_edited` prevents later native FVG enrichment from filling intentionally cleared annotations. Financial source conflicts retain the existing review behavior.

## Validation boundary

Focused unit/component tests and authenticated HTTP/PostgreSQL integration tests cover capture, patching, historical records, optional clearing, numeric validation, ownership, explicit CSV fields, deduplication and reimport protection. Local browser verification uses disposable local data. This is local implementation and validation, not hosted/deployed proof.
