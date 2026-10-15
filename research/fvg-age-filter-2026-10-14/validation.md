# FVG Age Filter validation — 14 October 2026

This record covers the user-confirmed target,
`devtrader-five-sessions-fvg-windows.pine`. The other Five Sessions strategy was
not edited. Existing `.env` edits and unrelated untracked files were preserved.

## Executed checks

- Production Pine helpers executed in TradingView: **223 / 223 assertions**.
  Coverage includes every allowed limit, confirmation age 0, inclusive final
  fill bars, cancellation decisions at the final eligible close, missing-age
  behavior, historical/realtime HTF index normalization, weekend clock gaps,
  bullish/bearish immutable fill metadata, and the existing FVG/BE/loss helpers.
  `qa-223-assertions.png` records the green runtime result. The generator uses
  production helpers verbatim; local generation alone is not Pine execution.
- **50 source integration checks** passed on the final source.
- **19 Python tests** passed, including unchanged detector/direction/stop/target/
  sizing declaration and BE/loss functions, legacy chart-export compatibility,
  analytical R/drawdown fixtures, real five-run native/log reconciliation,
  duplicate/missing/truncated log rejection, and missing-R handling.
- Full Pine v6 strategy compiled and ran in TradingView, saved privately as
  **Devtrader · Five Sessions FVG Windows · FVG Age Filter**. The new conditional
  history-helper warning was removed by indexing the globally evaluated source
  series directly. Remaining warnings concern the pre-existing auto-threshold
  `ta.cum` expression and intentional close-only `barstate.islast` table updates.
  Calculation settings were not changed to suppress those warnings.
- Original versus updated OFF run: **92 closed trades each**, and **all 2,944
  non-Signal native CSV cells identical**. This includes both same-candle round
  trips. Original source is preserved in `baseline-before-age-filter.pine`.
- A-E were executed separately on the same chart dataset and non-age trading
  settings. Complete native exports and Pine Logs reconciled **407 trades**.
  Identity, direction, entry/exit timestamps, net P/L, and independently derived
  fill ages matched. Every enabled fill was within its limit:

  | Mode | Closed trades | Observed source fill ages |
  | --- | ---: | --- |
  | A OFF | 92 | 1–37 |
  | B 2 | 65 | 1–2 |
  | C 3 | 81 | 1–3 |
  | D 4 | 83 | 1–4 |
  | E 6 | 86 | 1–6 |

- For identical entries shared with baseline, exit timestamp, reason, P/L,
  realized R, and fill age were unchanged: **50 B, 66 C, 69 D, 76 E trades**.
  Positions remained managed after their FVG pending deadline in **56 B, 64 C,
  58 D, 47 E trades**. This verifies that expiration does not close filled trades.
- Higher-timeframe smoke test: **15-minute source / 5-minute execution / max 3**,
  10 closed trades, fill ages **1, 2, 3**, zero late fills. All source ages matched
  independent timestamp buckets for these continuous intraday source bars. A
  trade filled seven chart bars after confirmation and correctly recorded source
  age 3. This is a functional check, not a sixth age-performance comparison.
- The final metadata history-lookup cleanup was followed by compilation/save,
  a repeated OFF export, and regression checks. All **92 complete age log
  records** were identical to the earlier OFF run, in addition to all original
  non-Signal native cells. The cleanup changes no age gate or source clock.
- `git diff --check` passed.

## Fixed run assumptions

PEPPERSTONE:GER40F, standard 5-minute chart, report period **15 June–14 October
2026**, high historical detail/Bar Magnifier, source default trading inputs,
25% entry depth, 1:1.5 R:R, BE 70% trigger / 0% protection, zero fees/slippage.
**USD 1,000,000 validation capital** was fixed across A-E so margin would not
prevent entries; source default remains USD 10,000. The initial original run at
USD 10,000 had no trades. These are functional emulator backtests under stated
settings, not the user's entire historical dataset, deployed app changes, live
orders, broker-fill proof, or out-of-sample results.

The original active TradingView layout/script was retained. A dedicated private
validation layout was created: <https://www.tradingview.com/chart/vae2K9SR/>.
Source default remains OFF, maximum 3, debug OFF. Source hashes and exact mode
matrix are in `run-manifest.json`.

## Acceptance boundaries

| Requested check | Evidence / remaining boundary |
| --- | --- |
| A OFF regression | Exact 92-trade native export regression above |
| B age 0 | Executed production helper assertions; new setups snapshot the confirmation source index |
| C age progression | All allowed limits in helper assertions; 407 real fill ages independently reconciled |
| D bars 1–3 permitted | C run actually filled at ages 1, 2, and 3 |
| E no fills in prohibited bars | All 315 enabled A-E trades and 10 HTF trades passed their limits; cancellation occurs at close N, not N+1 |
| F original 60-minute expiry | Selected source has no general 60-minute pending lifetime. Existing window/session and earliest-gap minute expiry expressions are preserved. A separate minute-setting=60 run was not performed |
| G open positions unaffected | Shared exits unchanged; positions held past pending FVG deadline as counted above |
| H new FVG cannot renew another | Plan source index is immutable; executed fill-capture/idempotence assertions and source wiring checks. Existing single-plan reservation behavior retained |
| I direction parity | Helper fixtures for both directions; enabled runs contain both long and short trades |
| J confirmed data only | Existing confirmed-close detector and lookahead_off request unchanged; HTF clock fixtures distinguish developing and completed bars |
| K timestamp/session/weekend/DST | Epoch-based identity and index age, unchanged IANA session scheduling, independent native timestamp checks and weekend clock fixture. Dedicated DST-transition and live restart tests were not performed; June–October 14 runs do not cross a DST change |
| L metadata association | 407 native/log joins, including every same-candle round trip; complete HTF smoke-test records |
| M Pine compilation | Full strategy compiled/saved and ran; runtime helper assertions executed |

Earliest-session-FVG mode's newly added queue pruning/gate is source-checked;
the five comparison runs used its existing default OFF. A dedicated queued-gap
mode run, live/realtime HTF transition test, exhaustive source-timeframe matrix,
and broker cancellation test remain manual follow-ups. Chart outputs/logs do
not expose Deep Backtesting's extended dataset. These limits do not turn absent
data into a passing result.

## Reproduce local checks

```sh
python3 backend/src/main/resources/pine/strategies/qa-five-sessions-fvg-age.py \
  --pine-output /tmp/qa-five-sessions-fvg-age.pine
python3 backend/src/main/resources/pine/strategies/qa-fvg-age-tools.py
git diff --check
```

Execute the generated Pine harness in TradingView to reproduce its runtime
assertions. The implementation guide contains separate A-E export instructions
and the comparison command. `comparison.md` and `comparison/comparison.json`
contain actual exploratory results, session/year buckets, drawdown, frequency,
and baseline-removal versus newly enabled opportunity analysis. No additional
parameters were optimized, no automatic winner was selected, and future
profitability is not inferred from the historical sample.
