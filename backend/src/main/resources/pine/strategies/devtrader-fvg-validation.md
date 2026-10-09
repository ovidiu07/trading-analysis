# Five Sessions Model validation — 2026-10-07

Source: `devtrader-fvg-trend-continuation.pine`, strategy title **Five Sessions Model**, Pine v6. Final private TradingView source revision 3 saved at 22:43 Europe/Bucharest. SHA-256: `100112380e31fcab3fd753581fc64d5e75ac0bf87acae0c969bbb3bf1d78028b`.

The previous v2 trend-continuation validation is preserved as `archive/devtrader-fvg-v2-validation.md`. Its 87-trade results and DTFVG2 snapshots do not validate this replacement model.

## TradingView execution

Private QA layout: https://www.tradingview.com/chart/obKaOHzp/ . Symbol `PEPPERSTONE:GER40F`, standard 5-minute candles, chart timezone UTC+3 / strategy Europe/Bucharest. Report range shown: June 8–October 7, 2026. Defaults: 5-session lookback, 60-minute context aggregation, 0.05% FVG minimum, 30% entry depth, 60-minute pending validity, 40 price-point maximum stop, 1.5R, maximum two fills per session.

Properties inspected: $10,000 USD initial capital, fixed 0.1 quantity, pyramiding 0, 1x long/short leverage, zero fees/slippage, high historical bar detail (Bar Magnifier), on-bar-close execution, one-tick order delay. This is an execution/implementation check, not a profitability or broker-execution claim.

| Check | Observed result |
| --- | --- |
| Final Pine compilation and chart execution | Passed; private revision 3 saved and applied without a compiler/runtime error. |
| Native default Strategy Tester run | 35 completed trades: 14 TP exits, 21 SL exits. |
| Maximum filled trades per session | Passed across all 33 traded session cycles. |
| Second trade only after first SL | Both second trades followed an actual exit marked SL. |
| Fresh setup after first exit | Second entry timestamps occur after first exit timestamps; source also requires a later execution bar for the new FVG. |
| Global overlap | No overlapping executed positions in the exported report. |
| Same-candle entry/exit | Three actual exported trades; each counted once. |
| Directional bias | All 35 entries agree with independently reconstructed evaluation price versus exact fifth preceding same-type session high. |
| FVG/entry/structural SL/TP | All 35 actual trades matched a qualifying completed FVG and structural bracket from raw OHLC, within one 0.1-price-unit tick. |
| Maximum SL | All observed SL exit distances are within 40 points plus tick normalization tolerance; source fixtures prove >40 rejection and =40 acceptance. |
| 15-minute chart, execution input 5 | No orders; visible warning immediately after load. Fixed a table initialization issue found by this test. |
| 61-minute validity on 5-minute chart | No orders; visible duration-alignment warning. Restored 60 afterwards. |
| Final restored configuration | Standard 5-minute chart, 60-minute validity, default inputs; report again contains 35 trades. |
| Visual example | Actual TradingView image downloaded, inspected, and saved as `qa-five-sessions-ger40f-2026-10-07.png`. |

The chart image displays September 29's Europe trade #1 SL, Europe trade #2 SL, and NY trade #1 TP. Its persistent table displays the latest loaded October 7 cycle, rather than the historical cursor date. Entry/SL/TP drawings are planned levels; emulator prices may differ by a tick. Other old QA indicators and manual drawings were hidden for the example.

## Reproducible local checks against real exports

Run from any directory:

```sh
python3 /Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/strategies/qa-five-sessions.py
```

Results:

- **31 source-expression fixtures passed:** long/short/neutral bias; valid/undersized gap percentage; bullish/bearish 30% entries; 1.5R arithmetic; >40, =40, and zero-stop gates; bullish/bearish preferred cluster location; first-SL/TP/other-result and maximum-count allowance; original activation/window-clipped expiry; exact window boundaries; post-exit freshness; expiry/session-rollover cancellation conditions.
- **19,650 exact fifth-session reference comparisons passed for each session**, independently aggregating raw OHLC over 88 observed reference-session dates. Calendar weekends add no dates without actual session bars. The incomplete first session is excluded.
- **19,306 Europe and 17,692 NY current-high comparisons passed**, independently aggregating eligible candles.
- **All 35 actual TradingView trade records passed** the direction, matching FVG/structural bracket, session entry-window, trade count, first-SL-only second trade, same-bar accounting and global overlap audits.
- Guide's complete code block matches the `.pine` file exactly. Whitespace checks passed, including the currently untracked Pine source.

Artifacts:

- `qa-five-sessions-trades-2026-10-07.csv`: actual Strategy Tester export, 70 entry/exit rows representing 35 completed trades.
- `qa-five-sessions-chart-2026-10-07.csv`: actual chart export, 20,834 OHLC rows including the final unconfirmed realtime row. The audit excludes that unconfirmed row and uses only the new strategy's named high plots and raw OHLC; legacy indicator columns in the raw export are ignored.
- `qa-five-sessions.py`: source-expression fixtures and independent CSV audits. This is not a Pine compiler or a replacement order-fill simulator.
- `qa-five-sessions-ger40f-2026-10-07.png`: actual native 5-minute chart image.

## Limits of this validation

The formula fixtures do not execute the full Pine state machine. Chart/trade CSV audits establish the listed observed invariants; they cannot prove every unfilled order lifecycle, every cluster replacement, overnight/DST configuration, missing-bar cancellation, symbol, margin setting, or fill path. Cluster replacement and expiry logic were reviewed and their scalar gates checked, but no claim is made that each rare lifecycle was observed in these 35 fills. Native cash/percentage sizing is delegated to TradingView; those modes were not separately re-tested for this replacement.

The final source change after the main CSV exports only initializes the dashboard on the last confirmed historical candle as well as the last bar. It does not alter signal/order logic. The final revision was recompiled and the restored native chart again showed the same 35 trades.

See the companion guide for explicit assumptions and unavoidable limitations: deadline-bar fills can precede bar-close cancellation; Pine cannot enforce wall-clock expiry while a feed gap prevents execution; limit/stop/target fills depend on available intrabar data and instrument tick precision. All costs in this QA run are zero. No broker trades, external news logic, public publication, deployment, or profitability recommendation are involved.
