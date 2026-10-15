# Five Sessions FVG Windows: FVG Age Filter

Implemented 14 October 2026 in `devtrader-five-sessions-fvg-windows.pine`.

## Settings and behavior

The **FVG Age Filter** group contains:

| Setting | Default | Allowed values |
| --- | --- | --- |
| Enable FVG Age Filter | OFF | OFF / ON |
| Maximum FVG Age | 3 | 2, 3, 4, 6 |
| Show FVG Age Debug Information | OFF | OFF / ON |

Each selected gap retains its confirmation bar, close timestamp, direction,
bounds, and identity. Each order snapshots the age settings, submission age,
submission timestamp, and originating direction session. New gaps cannot renew
an existing pending order. This strategy reserves a single pending/open plan;
it does not replace that pending plan when another FVG appears.

On the chart timeframe, confirmation has age 0 and age is
`bar_index - confirmationSourceBar`. Orders submitted at confirmation can first
fill in bar 1. A maximum of 3 permits fills during bars 1, 2, and 3. At the close
of bar 3, an unfilled entry is cancelled, before bar 4 can fill it. A new order
is also refused at that close, since it would first become executable in bar 4.

For a higher detection timeframe, decisions use completed **source** bars.
For example, three 15-minute source bars span nine normal 5-minute execution
bars. The source index containing the actual fill is recorded separately from
the source index completed at the calculation close. Intermediate child candles
do not prematurely age or expire the source gap. Weekend/feed gaps do not invent
additional completed bars. Epoch timestamps remain UTC milliseconds; display
formatting uses the existing configured IANA timezone.

Filled positions are reconciled before expiry checks. The filter only cancels
pending entries and their unused brackets; it does not amend an open stop,
target, quantity, break-even state, or loss limits. Same-candle entry/exit trades
are captured from `strategy.closedtrades` before plan cleanup.

The existing detector is preserved verbatim, including its middle-candle-close
condition and percentage threshold. Direction, chronological five-session
reference selection, trading windows, structural stop/tolerance, target,
position sizing, and protected-profit rules are unchanged.

## Existing-expiration mismatch in the request

This selected version has **no general configurable 60-minute pending lifetime**.
Its pending deadline is the earlier of the entry-window end and the candidate's
existing expiry. In earliest-session-FVG mode, that candidate expiry also uses
**Maximum FVG Age (minutes)** measured from confirmation (default 120 minutes)
and the direction-session end. These rules remain intact, including when this
existing minute setting is 60. With the new filter ON, the first of the existing
deadline, source-bar limit, or existing cancellation rules cancels the entry.
No new global 60-minute cap was added, because that would change the OFF baseline.

## Trade metadata and export

The native entry **Signal** keeps its existing `FVGv1` payload and appends
`FVGAGEv1`: composite FVG ID (`symbol:sourceTF:confirmationClose:direction`),
confirmation source index, submission age, enabled flag, selected maximum,
direction-session index/name, submission timestamp, and original stop. Existing
FVGv1 fields carry bounds, size, source timeframe, confirmation timestamp,
entry configuration, and R:R/BE settings. Native entry rows supply actual entry
time and direction. Surviving open trades also receive fill age and entry epoch
in their eventual exit comments.

An entry comment is created before the fill and cannot contain its future age.
A same-candle round trip can exit before the strategy can amend the exit comment.
The complete fill age for these trades is retained in the chart trade report,
chart-export series, and `FVG_AGE_V1` logs. This uses TradingView's
[entry/closed-trade ledgers and order-processing model](https://www.tradingview.com/pine-script-docs/concepts/strategies/).

The **FVG Trade Report** now displays actual source-bar fill age, and its
tooltips show the FVG ID, confirmation index, submission age, age configuration,
and session. Existing first-touch/chart-bar metrics remain separate.

Chart-data exports add four `FVG Trade:` columns: **Confirmation Source Bar**,
**Submission Age**, **Fill Age**, and **Signed Age Limit**. Positive limits mean
ON; negative limits mean OFF. This keeps the strategy within Pine's 64-plot
limit while preserving all existing columns. `export-fvg-trades.py` decodes the
signed limit into separate enabled/maximum fields. Its identifier suffix needs
the exported symbol/source timeframe to form the composite ID. Full identities
and session ownership are also carried in the native comments and age logs.

With **Log Closed FVG Trades As CSV (Pine Logs)** enabled, the existing
`FVG_TRADE_V1` record remains unchanged and an additional `FVG_AGE_V1` record
is emitted for every closed chart-run trade. Its fields are:

```text
schema,trade_number,fvg_id,direction,timeframe,confirmation_ms,
confirmation_source_bar,submission_age,fill_age,size_points,size_percent,
upper,lower,maximum_age,filter_enabled,session_index,session_start_ms,
submitted_ms,entry_ms,exit_ms,price_r,exit_reason,reported_profit,
initial_risk_account,realized_r
```

Session indices use the existing direction-session configuration: 1 = First
(default Tokyo), 2 = Second (default London), 3 = Third (default New York).
Renaming/reconfiguring sessions does not change these indices. Preserve the
session settings with each run; native comments retain the configured names.

`price_r` uses actual fill to original stop, excluding costs. `realized_r` uses
reported account P/L divided by actual initial stop risk in the account currency.
That denominator uses filled quantity, `syminfo.pointvalue`, and TradingView's
account conversion when the fill is first observed. A same-candle round trip uses
that same candle's conversion. Nonpositive/unavailable initial risk produces
unavailable R. This is analytical metadata; sizing remains the existing formula.
The configured sizing `pointValue` can differ from TradingView's instrument/FX
valuation, so requested account risk is not substituted for actual initial risk.

Pine Logs and chart outputs cover the chart dataset. They do not expose the
extended Deep Backtesting dataset. Native entry comments remain available there,
but complete same-candle fill age needs a matching chart run. See
[TradingView's Deep Backtesting output limitation](https://www.tradingview.com/support/solutions/43000670566-why-are-the-results-of-deep-backtesting-not-shown-on-the-chart/).
Never join chart and Deep Backtesting trades merely by trade number.

## Run and preserve the five configurations

| Mode | Filter | Maximum |
| --- | --- | ---: |
| A | OFF | 3 (ignored) |
| B | ON | 2 |
| C | ON | 3 |
| D | ON | 4 |
| E | ON | 6 |

1. Load the updated source into TradingView. Keep standard candles at the
   configured execution interval. Keep on-close calculation; leave on-order-fill,
   every-tick, and on-close order processing disabled as in the source.
2. Fix one symbol, execution/detection timeframes, exact dataset/date range,
   sessions and timezone settings, all non-age inputs, capital, margin, quantity,
   commission, slippage, limit-fill verification, and Bar Magnifier detail.
   Save screenshots/exported Properties and Inputs before running A.
3. Enable native FVG signal comments and closed-trade logs for every run. Debug
   display can stay OFF; it does not affect execution. Run A, then B, C, D, E,
   changing only the enabled flag/maximum age. Wait for each report to finish.
   Refresh an outdated Deep Backtesting report explicitly if using that mode.
4. For each run, download the native Trades CSV and save its Inputs/Properties.
   In Pine Editor → More → Pine logs → Settings → **Download logs**, download the
   separate chart-run log CSV as `A-pine-logs.csv` through `E-pine-logs.csv`.
   Compare its last trade number/count with that run's native chart report;
   contiguous logs can still have a missing tail. Do not combine different runs.
5. Keep the original source snapshot, updated source/hash, A-E inputs/properties,
   native CSVs, and logs. Do not change other strategy parameters after seeing
   the age comparison or make the historical winner the default.

Run the supplied comparison on complete chart-run logs:

```sh
python3 backend/src/main/resources/pine/strategies/compare-fvg-age.py \
  --A /path/to/A-pine-logs.csv --B /path/to/B-pine-logs.csv \
  --C /path/to/C-pine-logs.csv --D /path/to/D-pine-logs.csv \
  --E /path/to/E-pine-logs.csv --output-dir /path/to/fvg-age-comparison
```

This creates normalized A-E trade CSVs and `comparison.json`, including trade
counts, winning/losing/actual-zero-R trades, protected-stop exits, win rate,
total realized R, expectancy, profit factor in R, closed-trade maximum drawdown
in R, maximum consecutive losses, longest observed drawdown, session breakdowns,
and exit-year performance. It reports both money and R profit factors.
Protected-stop exits can overlap wins/losses/zero-R;
their actual return is used. Undefined profit factor and incomplete R coverage
remain unavailable. Annual buckets can be partial years.

Drawdown duration runs from the latest closed-equity high-water mark to recovery,
or the last observed exit if unrecovered. It is calendar time, with unrecovered
periods marked. These are closed-trade R equity metrics, distinct from the native
report's intrabar money drawdown. The tool rejects empty logs, missing/duplicate
trade numbers, mode mismatches, and out-of-limit fills; it does not execute Pine
or verify that non-age settings match. Check saved Properties independently.
Supply `--native-A /path/to/A-native-trades.csv` through `--native-E ...` to
also verify log tails/counts, FVG identities, directions, timestamps, and P/L
against the native exports. Set `--native-timezone` to the timezone used by those
CSV timestamps (default Europe/Bucharest). The delivered comparison uses all
five native cross-checks.

## Interpretation and limitations

These comparisons are **exploratory** because this historical dataset has
already been inspected. Compare expectancy, total R/profit, drawdown, frequency,
London/New York behavior, and yearly stability together. An age rule can remove
losses, remove winners, and free the single order reservation for different later
setups. Filtered results need not be a simple subset of baseline trades.

Keep transaction costs identical and rerun with a defensible cost assumption
before financial conclusions. Reserve a subsequent unseen period or other
predeclared out-of-sample test, without tuning sessions, entries, stops, R:R,
BE, loss limits, or size around the apparent best age. Historical results do not
establish future profitability.

Remaining boundaries: no execution while a feed has no bars; timestamps/indices
are dataset-dependent (composite IDs remain stable across history-depth changes);
actual fill observation needs chart history within the existing 5000-bar buffer
if not captured when first seen; report retains 1000 trades; Pine Logs and native
trade history have platform retention limits. Historical emulator/Bar Magnifier
results are not live broker cancellation/fill proof. Full validation evidence,
source hashes, and actual test-run outputs are in
`research/fvg-age-filter-2026-10-14/`.
