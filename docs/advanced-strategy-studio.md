# Advanced Strategy Studio

The existing authenticated `/strategies` route is the strategy development workspace. It uses the existing React/MUI frontend, Spring Boot services, PostgreSQL/Flyway database, user strategies, assets, version history, and backtesting research records. The advanced engine workspace described in `strategy-studio.md` remains a distinct engine configuration surface; custom documentation rules do not execute in that engine.

## Delivered workflow

- Strategy library: search, tags as categories, favorites, recent edits, lifecycle status, reversible archive/unarchive, blank creation, Five Sessions template, duplication and validated JSON import.
- Overview: editable instrument and market, timeframes, sessions, IANA timezone, direction, status, description, creation/update dates and eight formatted strategy summary areas. Existing entry, invalidation, exit and no-trade fields remain canonical and keep their existing callers.
- Notebook: text, headings, ordered/unordered lists, checklists, tables, quotes, callouts, dividers, code and authenticated images; bold, italic, underline, highlighting and safe links. Blocks support duplication, deletion, collapse, drag reordering and keyboard-accessible arrow controls. `/` in an empty block opens insertion choices. Tables have editable cells and row/column controls.
- Images: existing STRATEGY asset upload and access controls, JPEG/PNG/WebP/GIF up to the existing 20 MB limit, captions, attached-image selection, clipboard files and file drop. Removing a notebook block retains the underlying attachment so previous checkpoints can still refer to it. Navigation waits for uploads and the resulting document save.
- Parameters: all twelve requested types, current/default values, explicit units, bounds, steps, option lists, custom categories, searching, enabled state, duplication, order and reset. Percentage values use percent units: `0.05` means `0.05%`, never 0.05 points. Duration and price-distance values require a unit. Both current and default values and all preset values are validated. Current parameter deletion is blocked while a rule or preset references it; older version snapshots remain independent.
- Presets: named persistent configurations, apply without mutating historical snapshots, compare with the current configuration or another named preset.
- Rules: required/optional and enabled states, custom categories, sequencing, notes, parameter references, observations, manual confirmation, comparisons and nested AND/OR/NOT groups. A readable expression accompanies the condition editor. These are documentation/manual checks; they are not labeled executable trading logic.
- Checklists: strategy templates, mandatory items, groups, order, duplication, reset/progress, immutable server-side execution records, and reuse of existing session checklist content. The existing daily/session checklist lifecycle remains intact. Copying a session template is an explicit editable research snapshot. An execution captures its template and the exact current strategy definition and revision.
- Evidence: persisted notes, hypotheses, conclusions and limitations; screenshots and existing workspace references; explicit linking of stored research trades to a strategy, optional checkpoint and in/out-of-sample annotation. No market data or order execution engine is added.
- Research: existing trade responses, `computeResearchMetrics`, `ResearchPerformance` and charts; stored BACKTEST/REPLAY data, excluding LIVE records. Filters reuse instrument/session/dates/direction/setup/HTF/liquidity/sweep/FVG metadata plus optional version/sample annotations. Cash results remain separated by currency; incomplete R data remains unavailable. Samples are counted rather than asserted to be statistically validated.
- Versions: named checkpoints with change notes, complete snapshots, readable changed/added/removed comparisons, historical parameter/rule/notebook/checklist inspection, and restoration through a new checkpoint. Existing checkpoints and trade-version relationships are preserved. New preparation snapshots attach a checkpoint only when its content matches the saved draft; an ahead-of-checkpoint draft is not mislabeled as an older checkpoint.
- Export: complete schema-versioned JSON and readable Markdown. JSON imports create a new owned strategy and reject unsupported schema/fields, malformed collections, invalid references, foreign assets and oversized input. Private image binaries, existing trade records and history are not embedded in a strategy definition export. Asset IDs can be reused when the importing owner still has access; inaccessible references are rejected rather than silently discarded.

## Persistence and compatibility

`V79__advanced_strategy_studio.sql` adds:

| Existing structure | Extension |
| --- | --- |
| `user_strategies` | Optimistic `revision` and nullable `studio_json` JSONB |
| `strategy_versions` | Checkpoint name and change description; existing `snapshot_json` stores the complete configuration |
| `backtesting_trades` | Nullable `strategy_version_id` FK and `research_sample`; existing strategy and ICT/FVG metadata fields are reused |
| New execution records | `strategy_checklist_executions`, with owner/strategy/version references, immutable JSON snapshots/answers and an owner/history index |

No migration rewrites existing strategies, trade prices, imported signals, P&L, or historical version assignments. Strategies remain user-owned rather than introducing a second account-specific strategy system. Explicit reassignment through existing research trade editing clears an incompatible checkpoint reference; ordinary edits preserve it.

Autosaves are debounced by 900 ms and serialized. Every write supplies the expected revision. The server takes an owned row lock and rejects stale writes with HTTP 409. Edits made during an earlier save are retained for a subsequent save. A failed save leaves the draft visible, offers retry and blocks navigation. Conflict review compares the newer server document with the retained draft before an explicit replacement or server-copy choice. Temporary session storage supports recovery; saved content is on the server. Browser close protection and visibility-triggered saving supplement server persistence. Forced browser/process termination cannot guarantee completion of an in-flight network request; this is why server save status and recovery are explicit.

Definition limits are 2 MB, 500 notebook blocks, 200 parameters, 100 presets, 200 rules, 100 checklist templates, 200 items/template, 200 evidence notes and eight nested condition levels. Portable imports are limited to 4 MB to accommodate legacy metadata and asset references alongside the bounded definition. Tables allow 100 rows and 20 columns. Checklist history returns the latest 100 executions; records remain stored.

## API additions

All routes use the existing authentication and owner resolution.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/strategies/studio` | Create a native studio strategy |
| GET, PUT | `/api/strategies/{id}/studio` | Load/save with expected revision |
| POST | `/api/strategies/{id}/duplicate` | Create an owned copy |
| GET, POST | `/api/strategies/{id}/versions` | Summaries / named checkpoint |
| GET | `/api/strategies/{id}/versions/{versionId}` | Read immutable snapshot |
| POST | `/api/strategies/{id}/versions/{versionId}/restore` | Restore as a new checkpoint |
| GET | `/api/strategies/{id}/export` | Portable JSON definition |
| POST | `/api/strategies/import` | Validate and import as a new strategy |
| GET, POST | `/api/strategies/{id}/checklist-executions` | Immutable checklist runs |
| GET | `/api/strategies/{id}/studio/evidence` | Associated existing research records |
| POST | `/api/strategies/{id}/studio/trades` | Explicit trade/version/sample assignment |

Existing strategy CRUD, archive, secure asset upload/view, Backtesting workspace/trade APIs and Today/session APIs continue to serve their existing roles.

## Main implementation files

Frontend: `pages/StrategiesPage.tsx`, `api/strategyStudio.ts` and `features/strategyStudio/{StudioEditor,Notebook,Parameters,Rules,Checklists,Evidence,VersionHistory,useStudioDraft,model,labels}`. Shared rich-text components are extended; MUI, React Query, router navigation protection and existing research components are reused. No new application dependency is added.

Backend: `StrategyStudioController`, `StrategyStudioService`, `StudioDefinitionValidator`, `StudioWriteRequest`, and the checklist execution entity/repository. Existing strategy entities/service/repositories and research response mapping are extended. Checkpoint matching is reused by the existing context/preparation snapshot services.

## Validation and release

See `../output/strategy-studio-2026-10-16/validation.md` for executed results and screenshots. Database integration runs against the separate local `codex_strategy_studio_20261016` database. Test accounts and sample trades are synthetic fixtures, not imported user or production performance. Storage integration tests substitute the S3 interface; a real cloud bucket upload was not performed.

Deploy backend and frontend together. Flyway applies V79 on backend startup using the normal migration process; existing strategies receive a default empty studio document when opened. Keep the existing S3 configuration and permissions in place. Run the existing environment's authenticated asset smoke test after deployment, along with create/save/reopen/checkpoint/restore and a stale-tab save. No commit, push, deployment, account purchase or production data mutation is part of this local delivery.

Navigation behaviour follows the supported [React Router blocker API](https://reactrouter.com/6.30.3/hooks/use-blocker). Browser unload protection is supplementary because of the platform limitations documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
