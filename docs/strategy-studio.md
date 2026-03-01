# Strategy Studio

## Purpose
Strategy Studio replaces the old advanced-lab mental model with a structured, inspectable workspace for power users.

Entry points:
- Step 2 mode switch (`Quick Backtest` -> `Strategy Studio`)
- Step 4 action (`Open Strategy Studio`)

## Tab Layout

## 1) Recipe
- Human-editable strategy definition.
- Uses existing config model with all advanced controls.
- Includes preset/template tools and save/continue actions.

Cards/sections map to recipe blocks:
- Context
- Liquidity source
- Sweep rule
- Displacement rule
- Structure shift rule (MSS/BOS)
- Entry rule
- Risk rule
- Exit rule

## 2) Rules Map
Visualized logic chain:
- Pool detected -> Sweep valid -> Displacement valid -> MSS/BOS valid -> Retrace valid -> Entry valid -> Exit logic

Each stage shows:
- active summary from current config
- invalidation reason
- quick action to jump back to Recipe edit

## 3) Candidates
Candidate-first review surface:
- state chip (`DETECTED`, `QUALIFIED`, `EXPIRED`, `REJECTED_*`, `CONVERTED_TO_TRADE`)
- session/symbol/quality
- short storyline
- qualified/failed reason text
- actions:
- accept
- reject
- inspect
- edit interpretation (jump to Recipe)
- rerun (Regenerate Backtest)

## 4) Optimize
Optimizer moved here to keep quick flow clean.

Shows:
- leaderboard cards:
- best win-rate
- best expectancy
- best balanced
- recommended live
- variant table with apply action
- rerun/regenerate controls

## Backend Contracts Used
- `GET /api/backtest/runs/{runId}/candidates`
- `PATCH /api/backtest/candidates/{candidateId}/review`
- `POST /api/backtest/dataset-sets/{id}/optimizer/runs`
- `GET /api/backtest/optimizer/runs/{optimizerRunId}`

## Progressive Disclosure Levels
- Level 1 (Quick): essential controls only
- Level 2 (Studio): recipe + rules + candidates + optimize
- Level 3 (Diagnostics): raw timeline/event payloads in storyline diagnostics drawer
