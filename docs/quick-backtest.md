# Quick Backtest

## Goal
Default path for non-quant users:
1. Upload CSVs
2. Select template
3. Tune a few high-impact settings
4. Run scan/backtest
5. Review candidate/trade outcomes
6. Move to Strategy Studio only when deeper diagnostics are needed

## UX Contract
Quick Backtest is default in step 2 of `BacktestLabWizard`.

### Always-visible fields
- Strategy template
- Context timeframe
- Pool timeframe
- Entry timeframe
- Sweep type
- Minimum sweep depth
- Displacement strictness
- MSS strictness
- Retrace required
- Retrace %
- Entry model
- SL model
- TP model

### Progressive disclosure
- `Advanced settings` collapse contains realism and secondary controls.
- Full parameter editing is in Strategy Studio Recipe tab.

## Template Families
Implemented template shortcuts:
- Asia Sweep -> London Reversal
- London Sweep -> New York Reversal
- Sweep -> Displacement -> FVG Retrace
- BOS Continuation
- PDH/PDL Reversal

Each template applies sensible defaults to config JSON.

## Result Style
Quick results now emphasize:
- summary KPIs
- candidate flow counts
- best/worst setup cards
- trade storyline access
- button to open Strategy Studio

Raw diagnostics remain available in storyline drawer diagnostics collapse.

## API Flow
- Save config: `POST /api/backtest/dataset-sets/{id}/strategy-configs`
- Run backtest: `POST /api/backtest/dataset-sets/{id}/runs`
- Load results: `GET /api/backtest/runs/{runId}/results`
- Optional report: `GET /api/backtest/runs/{runId}/report`

## Validation Rules
`Regenerate Backtest` blocks when:
- no dataset set
- selected dataset timeframe is still processing
- dataset not runnable
- zero candles
- invalid date window

Warnings are shown but runnable WARN datasets can still execute.

## Regression Coverage
Frontend coverage in:
- `frontend/src/features/backtest/BacktestLabWizard.test.tsx`

Includes:
- quick controls visible by default
- upload/save/run flow
- storyline-oriented result rendering
