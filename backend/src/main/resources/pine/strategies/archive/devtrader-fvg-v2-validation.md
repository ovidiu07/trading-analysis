# Validation — 2026-10-06

Source: `devtrader-fvg-trend-continuation.pine`, v2. TradingView compile and broker-emulator checks performed in a separate private **Devtrader FVG QA** layout, on `PEPPERSTONE:GER40F`, standard 5-minute candles. Report range displayed: 2026-06-08 through 2026-10-06. $10,000 USD initial capital, 1x leverage (100% margin), zero commission/slippage, bar-close execution, high intrabar detail. Default Structure breaks, 4H/1H agreement, automatic FVG threshold, near-edge entry, 1R target. These are execution checks, not broker-cost validation or a profitability recommendation.

| Test | Observed result |
| --- | --- |
| Pine compilation and chart execution | Passed; script added and updated on chart without compiler/runtime error. |
| Properties: fixed 0.1 quantity | 87 closed trades. |
| Properties: EUR 3,000 cash, EUR 10,000 capital | 87 closed trades with native account-currency cash sizing. |
| Properties: 30% of equity | 71 closed trades; sizing can exclude opportunities when equity allocation is below the minimum notional. |
| Properties: 1% of $10,000 | No fills; minimum-quantity diagnostic visible. |
| Properties: $100 cash, Skip and explain | No fills, as expected for below-minimum notional. |
| Properties: $100 cash, explicit Use minimum override | 87 closed trades with 0.1 quantity; budget-exceeding fallback is deliberate. |
| Inputs: Risk 1% of equity, exposure cap 1x | 87 closed trades; latest example size 0.3. Actual stop risk reduced by exposure cap. |
| Inputs: Risk cash $100, exposure cap 1x | 87 closed trades; latest example size 0.3. Actual stop risk reduced by exposure cap. |
| Same-candle entry/exit | Actual report included entry and exit at 2026-10-06 09:30, entry 25,517.1, SL 25,497.0, TP/exit 25,537.2; corresponding trade-map/export created. |
| Cross-timeframe viewer | Imported 13 actual exported trades; verified native timestamp drawings on 1m, 15m, 1H and 4H. No new strategy orders on those viewing charts. |
| Original FVG detector | Both functions match `published/devtrader-chart.pine` verbatim. |
| Planned RR arithmetic | 12,000 local integer-tick/R-multiple invariants passed. These do not substitute for fill simulation. |

TradingView reported `syminfo.mincontract = 0.1`; the minimum account-currency notional was approximately $2,870 at the inspected price/conversion. This is time-sensitive and specific to this feed, not a universal specification for every GER40 instrument or broker account.

Trade counts can change with loaded history, feed revisions, intrabar availability, settings, commissions and currency conversions. No claim is made that every broker, symbol, chart type or leverage setting has been tested.

Artifacts: `qa-ger40f-15m.png` is the actual TradingView chart export from the 15-minute viewer, and `qa-ger40f-snapshot.txt` contains three actual emulator records from the checked run for a reproducible viewer example. The final saved browser QA layout contains the three example rows; 13 rows were used during the earlier multi-timeframe checks. Final source revision 4 was saved and compiled at 14:00, its native fixed-quantity run again showed 87 completed trades, and the compact 15-minute viewer displayed 3/3 records. The script can retain/export up to 120 completed trades.
