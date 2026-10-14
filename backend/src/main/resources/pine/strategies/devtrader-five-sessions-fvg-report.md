# FVG trade diagnostics and protected profit

Applies to `devtrader-five-sessions-fvg-windows.pine` (14 October 2026).
Private TradingView script: **Devtrader · Five Sessions FVG Windows · FVG Report + Profit Lock**.

## Entry configuration

Under **Strategy Execution**:

- **Use FVG Entry Percentage** checked: enter at the configured depth from the
  retest edge. Bullish gaps measure from the upper edge down; bearish gaps from
  the lower edge up. The existing default remains 25%.
- Unchecked: use the near edge, equivalent to 0% depth. A resting limit order
  can fill on any subsequent eligible touch/mitigation. The percentage field
  becomes inactive. This does not create a retrospective trade on the gap's
  formation candle or on an earlier touch before the order existed.

The original direction, entry windows, maximum SL/tolerance, quantity, pending
expiration, and session/daily loss rules still apply. A near-edge entry can have
a wider structural stop and may therefore fail an existing maximum-SL check.
More eligible touches do not guarantee more total trades in every configuration.

## Break-even / protected profit configuration

Under **Strategy Breakeven**, trigger and destination are independent:

| Input | Existing default | Requested example |
| --- | ---: | ---: |
| Reward / Risk (in Strategy Execution) | 1.5 | 3 |
| Enable Breakeven | checked | checked |
| Breakeven Trigger (% Of Entry-To-TP Distance) | 70 | 90 |
| BE Protected Profit (% Of Entry-To-TP Distance) | 0 | 30 |

Both percentages use **actual filled entry to the fixed TP**. For a long with
entry 100, SL 90 and TP 130, the 90% trigger is 127 (+2.7R) and the 30% protected
stop is 109 (+0.9R). The equivalent short has entry 100, SL 110, TP 70, trigger
73 and protected stop 91. A destination of 0 retains ordinary entry-price BE.

Protected profit must be below the trigger. Invalid combinations produce an
explicit runtime error when BE is enabled. Trigger prices round toward TP;
protected-stop prices round toward entry. The stop latches once and never
loosens an existing better stop; the original target stays fixed.

Calculations remain on confirmed closes. The entry candle uses its close to
avoid pre-fill wicks; subsequent candles use high for longs and low for shorts.
An amended stop becomes eligible from the next tick, not earlier within the
trigger candle. A retracement before that close, fees, or a gap may produce a
worse realized exit than the protected price. The BE exit label describes the
stop rule; it can represent a profitable exit. Loss streaks use reported closed
P/L, independently of that label.

## Details for each closed trade

The **FVG Trade Report** retains the most recent 1000 closed chart-run trades.
Use **FVG Report Page** (1 is newest), **FVG Report Rows**, and **FVG Report Text
Size** under **Strategy Visuals / Audit**. Hover over a cell for the order ID,
creation/entry timestamps, and original Entry/SL/TP. It includes:

- Direction and gap detection timeframe.
- Third-candle confirmation time, lower and upper gap prices.
- Gap width in price units, configured points/pips, and percent. Percentage uses
  the same denominator as the existing detector: lower edge for bullish gaps,
  upper edge for bearish gaps.
- Planned entry mode and depth, actual fill price and actual depth percent.
- Chart bars from creation to first touch and to entry, and elapsed minutes
  from confirmation to entry. Creation candle is bar 0; the next candle is bar
  1, even when its opening fill has zero elapsed minutes after confirmation.
- Exit reason, reported money P/L, and price R relative to the actual fill and
  original stop. Price R excludes fees; if actual initial risk is nonpositive,
  R is unavailable rather than fabricated.
- Whether profit protection activated, plus the selected R:R/BE configuration.

First touch means candle-range overlap after confirmation; invalidation means
a close through the far edge. A deeper percentage entry may occur later than
the first touch. If an emulator fill gaps through the entire zone without range
overlap, the entry bar is the first entry-touch fallback. Fill depth is not
clamped to 0–100: gap fills and tick rounding remain visible in the report.

The audit reads both the open and closed trade ledgers, so a position that opens
and closes within one chart candle still receives a record. Closed values remain
associated with their original plan even if a new setup is submitted on the
same close.

## Native report and exports

With **Include FVG Details In Strategy Trade Signals** checked, native entry
signals include a versioned `FVGv1` payload: detection timeframe, gap bounds,
size, size percent, confirmation timestamp (UTC milliseconds), entry mode/depth,
configured R:R and BE trigger/destination. Exit signals also receive fill depth,
bars to fill/first touch and age in minutes once a surviving open position has
been observed. Entry signals are created before the actual fill and cannot
contain future fill metrics. Same-candle entry/exit trades keep their original
SL/TP signal; their complete metrics are in the chart audit instead.

This checkbox is independent from **Log Closed FVG Trades As CSV (Pine Logs)**.
Enabling logs does not add details to the downloaded native trade CSV. Existing
chart instances retain their saved inputs when the script is updated: check the
signal option explicitly, close Inputs with **Ok**, and click **Update report**
when TradingView marks a Deep Backtesting report as outdated. In the Trades tab,
enable **Signal** under Column setup to see the comments on screen.

The 14 October user export `_365f4.csv` had 523 closed trades with no FVG signal
payloads. After enabling the signal option on the active GER40F chart, the fresh
native export `_bb5c2.csv` had the same 523 executions and FVG payloads on all
523 entries. Exit timing payloads were available on 501 trades; 22 same-candle
round trips had plain SL/TP exits. All non-Signal source cells were unchanged.

TradeJAudit's native replay importer now reads `FVGv1` into gap presence/type,
timeframe, high/low/midpoint, size percent and actual entry depth. Source width
is exported separately as **FVG size (price units)** because native comments
do not contain the point/pip divisor. Gap creation time is mapped to the import
timezone only when explicitly supplied; the full source timestamp is always
available as **FVG created (UTC)** in the app export. Exact first-touch clock
and zone fill status remain unavailable. Depth outside 0–100 is preserved in
the FVG diagnostic export and leaves the bounded editable gap-depth field blank.

The app export also includes entry mode, planned/actual depth, bars to entry and
first touch, elapsed minutes, configured R:R and independent BE percentages.
Unavailable same-candle timing stays blank. Repeat imports can add missing FVG
facts to identical previously imported replay executions with empty gap research;
preview is read-only, existing gap annotations are preserved, and trade IDs,
cash results, R values, notes and tags are retained. Existing executions with
conflicting PnL/currency still require review. This app change is locally tested;
the deployed application and workspace have not been updated by this work.

The native report has a fixed column structure; these are signal comments, not
custom native columns. Unique comments also split native "By signals" grouping;
select "By side" or disable the comments if that grouping is inconvenient.

For a flat CSV with one row per closed trade:

1. Use TradingView's layout menu → **Download chart data** with the updated
   strategy on the chart. Export the bars covering the trades to examine.
2. Run the included extractor:

   ```sh
   python3 backend/src/main/resources/pine/strategies/export-fvg-trades.py \
     "/path/to/PEPPERSTONE_GER40F, 5.csv" --output /path/to/fvg-trades.csv
   ```

The extractor selects `FVG Trade:` columns, keeps only closed-trade rows, adds
UTC dates, direction/exit names and point/pip sizes, and rejects missing or
ambiguous fields. It preserves unavailable numeric values. It does not import
native strategy-report XLSX files. Chart exports can cover fewer bars than the
strategy report; check the exported trade numbers and date coverage.

Optional **Log Closed FVG Trades As CSV (Pine Logs)** writes a `FVG_TRADE_V1`
record per closed chart-run trade. Field order is:

```text
schema,trade_number,order_id,direction,detection_timeframe,created_ms,
lower,upper,size_price,size_percent,entry_mode,planned_depth_percent,
planned_entry,actual_entry,actual_depth_percent,bars_to_fill,
bars_to_first_touch,minutes_to_fill,entry_ms,exit_ms,initial_sl,tp,
configured_rr,be_trigger_percent,be_lock_percent,be_activated,
exit_price,exit_reason,reported_profit,price_r
```

**Deep Backtesting boundary:** native signal comments carry their gap and
configuration details into Deep Backtesting. Chart tables, plots, and Pine Logs
use the chart dataset and do not expose the extended Deep Backtesting dataset.
Do not join chart-run audit rows to Deep Backtesting trades by trade number.
See [TradingView's strategy documentation](https://www.tradingview.com/pine-script-docs/concepts/strategies/)
and [its explanation of Deep Backtesting chart output](https://www.tradingview.com/support/solutions/43000670566-why-are-the-results-of-deep-backtesting-not-shown-on-the-chart/).

## Focused validation

```sh
python3 backend/src/main/resources/pine/strategies/qa-five-sessions-fvg-report.py \
  --pine-output /tmp/qa-five-sessions-fvg-report.pine
git diff --check
```

- 39 local source integration checks passed.
- The generated indicator executed in TradingView on PEPPERSTONE:GER40F, standard
  5-minute candles, displaying **PASS 100 / 100 FVG + BE + loss assertions**.
  It uses the production helpers verbatim. Coverage includes both directions,
  enabled/disabled depth, tick rounding, first touch versus entry, gap-through
  depth, fill capture without an open observation, idempotent capture, 90/30
  protection, stop latching and the existing session/daily loss rules.
- The complete strategy compiled and ran. Functional comparison used the same
  chart-report period, 15 June–14 October 2026, high historical detail, on-close
  calculation, zero fees/slippage, and **USD 1,000,000 test capital** to avoid
  margin preventing entries. Source defaults still use USD 10,000. Risk input
  was 100, point value 1.15, maximum SL 36 plus tolerance 9, and existing loss
  limits 2/session and 3/day. Earliest-session-FVG mode was off.

| Functional run | Completed simulated trades |
| --- | ---: |
| 25% FVG entry, R:R 1:1.5, BE trigger 70% / lock 0% | 92 |
| Any touch, R:R 1:1.5, BE trigger 70% / lock 0% | 100 |
| Any touch, R:R 1:3, BE trigger 90% / lock 30% | 92 |

The first two isolate entry mode. The third changes holding/exit behavior too
and is not an entry-only comparison. These are functional emulator checks, not
a search for the best parameters, account-sized results or broker-fill proof.

Three real chart CSV extracts (301, 301 and 303 bars) exercised the CSV extractor. Each
contained only its last closed trade, so this is **three sampled export rows**,
not an independent audit of every trade in the report. Recomputed gap depth,
elapsed minutes, first-touch ordering and price R matched those rows. Missing
FVG export columns failed explicitly without writing an empty success output.
Artifacts are under `research/fvg-strategy-2026-10-14/`.

Final compiled source SHA-256:
`1603f5aafba7e20e7022e911a7cf4659699c75bda2c66134a058fca850381277`.
The final report layout was recompiled and visually checked after its last edit;
the requested any-touch / 1:3 / 90-to-30 run still had 92 closed simulated trades.
