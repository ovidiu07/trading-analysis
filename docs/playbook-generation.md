# Playbook Generation

## Objective
Convert validated backtest behavior into a reusable live-trading playbook and bind it into Today session workflow.

## Domain Objects
- `StrategyPlaybook`
- `PlaybookValidationSummary`
- Today session active playbook snapshot fields on `TodaySession`

## Promotion Flow
1. Run backtest and load run results.
2. Promote run:
- `POST /api/backtest/runs/{runId}/playbook`
3. Backend builds:
- template family
- preferred sessions/pools
- confirmation sequence
- entry/SL/TP model summary
- scorecard (win-rate, expectancy, PF, DD, fill-rate)
- validation summary
4. Playbook persisted in `strategy_playbooks`.

## Today Integration
Apply playbook endpoint:
- `POST /api/sessions/today/playbook/{playbookId}/apply`

Effect:
- sets `today_sessions.active_playbook_id`
- stores `active_playbook_name`
- stores `active_playbook_snapshot_json`
- returns `TodaySessionResponse.activePlaybook`

## UI Actions
In backtest results step:
- `Promote to Playbook`
- `Apply Playbook to Today`
- alert confirms active playbook name

## Scoring Notes
Playbook output includes:
- expected win rate
- expectancy
- profit factor
- max drawdown
- sample size
- confidence label
- validation split marker (`single-window` currently; model prepared for in-sample/validation/forward split extension)

## Migration
`V38__backtest_candidates_and_playbooks.sql` adds:
- `strategy_playbooks` table
- Today session active playbook columns + FK
