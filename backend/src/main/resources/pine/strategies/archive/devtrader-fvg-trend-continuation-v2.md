# Devtrader FVG Trend Continuation v2

Use `devtrader-fvg-trend-continuation.pine`. The original `published/devtrader-chart.pine` remains unchanged. Its two FVG detection functions are copied verbatim, including the automatic cumulative threshold and middle-candle close condition.

## What changed

- Retains up to 200 valid five-minute FVGs instead of overwriting a single setup. Zones can form before HTF alignment, or while another position is open, and remain eligible if still valid when the strategy becomes available.
- Selects the closest eligible zone in the pullback direction. Other zones remain in the pool. One position is allowed at a time; this does not claim to fill every overlapping setup simultaneously.
- No blanket hourly cancellation. At a confirmed five-minute close coinciding with an HTF close, the now-closed HTF state is used immediately. Between boundaries, requests use the prior confirmed HTF state with `[1]` and `lookahead_on`.
- Default trend is **Structure breaks**: a confirmed HTF close above/below the latest confirmed pivot changes directional bias, which persists until the opposite break. Both 4H and 1H must agree. The former **Strict HH/HL** method and **EMA alignment** remain selectable. These alternatives change the strategy definition explicitly, not just its sensitivity.
- Default entry is the near FVG edge (first touch), editable from 0% to 100% depth. Default zone life is 288 five-minute bars. The automatic threshold stays enabled to match the source indicator. Disable it with threshold 0 if you deliberately want all gaps that satisfy the original pattern, including smaller gaps.
- Filled trades have persistent, labelled **ENTRY / SL / TP** lines, including trades that open and close within one candle. These use actual emulator fill prices for entry and the original fixed protective levels. Pending-order plots are labelled separately.

## Why $100 / 1% did not trade on GER40F

In **Strategy Properties**, cash and percent-of-equity sizing mean **position notional**, not money risked at the stop. At $10,000 capital, 1% means $100 notional.

On the checked `PEPPERSTONE:GER40F` TradingView feed, the minimum quantity is **0.1**. At the checked price and currency conversion, that was approximately **$2,870 notional**. A $100 notional request cannot buy this minimum size. The minimum value changes with price and exchange rates; use the strategy's live diagnostics. Also, one full unit exceeds $10,000 equity at 100% margin.

The strategy now shows the requested quantity, rounded quantity, minimum quantity, minimum notional in the account currency, and last sizing decision. Its new default is $10,000 USD capital and **0.1 fixed units**, with 100% margin. This default suits the reported GER40F test but is not a universal contract size for other instruments.

### Sizing modes

| Input: Sizing source | Meaning |
| --- | --- |
| Strategy Properties (default) | Honors Quantity, cash (USD/EUR/etc.), and % of equity in Properties. It delegates with `qty=na`; account-currency conversion remains native to TradingView. |
| Risk % of equity | Computes quantity from equity × risk % divided by the stop distance × instrument point value, converted to account currency. |
| Risk cash | Uses a fixed stop-risk budget in the account currency selected in Properties. |

Risk modes round quantity **down** to `syminfo.mincontract` and cap notional exposure at **95% of equity × Risk sizing: maximum notional / equity**. The default multiplier is 1, so many GER40F trades will risk less than the requested $100 rather than use unstated leverage. Increase this multiplier only together with appropriate leverage/margin in Properties if that matches the test you intend. The input cannot change TradingView's broker margin setting. Fees, currency movements and stop slippage can change realized risk.

**Below minimum quantity** has two choices:

- **Skip and explain** (default): respect the requested allocation; no artificial fill below the exchange/feed minimum.
- **Use minimum (exceeds budget)**: explicitly permit 0.1 or the current symbol minimum even when this exceeds your cash, percentage, or stop-risk request. The dashboard warns about the increase. Capital/margin still apply. This also handles native quantity calculations that have already rounded a small positive allocation to zero.

Changing account currency to EUR makes cash allocations and risk-cash budgets EUR amounts; it does not change the symbol's price currency. Notional, margin/deposit, and stop-loss risk are different quantities.

## Trade lifecycle

FVGs are detected only at a confirmed five-minute candle close. An order cannot fill on its formation candle. Default first-retest mode retires a gap once its selected entry level was touched without an active order; disable this option to allow later retests of zones not invalidated by a close through the far edge. Filled zones cannot be reused.

Unfilled orders can be cancelled or replaced at five-minute closes when alignment changes, a closer eligible zone becomes available, a zone expires/is invalidated, or the entry date window ends. Cancellation cannot undo an intrabar fill that occurred earlier in the candle. A stop/target bracket is attached at order submission and remains fixed once filled. Open positions continue to their exits after the date window ends. A new order can be armed at the closing evaluation after a prior trade exits; it fills no earlier than the next tick.

Default target is 1R, editable upward. Tick rounding is outward so the planned target does not fall below the selected RR. Actual fills, gaps, costs and margin liquidation can change realized RR. There are no partial-profit, trailing-stop, or automatic reversal rules.

## Viewing the SAME trades on other chart timeframes

TradingView's strategy emulator runs on the chart timeframe. Re-running a strategy on 1H or 4H cannot preserve the actual five-minute order sequence simply by requesting five-minute candles. This script therefore has two honest modes:

- **Standard 5-minute chart:** native strategy execution, report, and live trade drawings.
- **Any other chart interval:** timestamp-based viewer for the exact exported five-minute fills; no new strategy orders. Without a snapshot it explains how to load one instead of raising the old timeframe error.

To carry actual trades across intervals:

1. Run the strategy on 5m with your chosen inputs and Properties.
2. In Inputs, enable **Export filled trades to Pine Logs**. Open **Pine Logs** from the Pine Editor's More menu.
3. Copy the `DTFVG2|...` rows into **Filled-trade snapshot for other timeframes**. One row per line; log timestamp prefixes are accepted. Export includes the retained closed trades and the current open trade, if any.
4. Change the chart to 1m, 15m, 1H, 4H, daily, or another interval. Entry, SL and TP prices and fill timestamps remain those of the exported five-minute trades. The snapshot is symbol-checked and carries its capture time and OPEN/CLOSED state.
5. Toggle export off/on and replace the snapshot when you want newer trades or after changing strategy settings. It is a **fixed snapshot**, not automatic live synchronization. Do not interpret the empty Strategy Report on a viewing timeframe as a second backtest.

The same script serves as the viewer; no second indicator is needed. In a multi-chart layout, paste the snapshot into each desired instance. Use Visibility settings to include the desired chart intervals. Snapshot input is ignored on the native 5m chart, which continues executing its current settings.

Drawings retain 80 completed trades by default (up to 120). Line length is at least 30 minutes or three viewing bars, whichever is longer, to keep short trades visible even on higher timeframes. This visual extension does not change entry/exit times; the label tooltip contains the fill time and snapshot state. Reduce the retained count to inspect a crowded area. Entry is cyan/blue, SL red, TP green. Dashboard values describe the native run or explicitly identify snapshot mode.

## Testing and limitations

Keep execution on bar close and order delay at one tick, with fill-triggered and every-tick recalculation disabled. Use standard prices for execution. Set commission, spread/slippage assumptions and margin/leverage deliberately; defaults are zero costs and unleveraged. Bar Magnifier is requested, but available intrabar history varies by plan and dataset.

See `devtrader-fvg-validation.md` for current compile/runtime checks and their exact scope. Counts are evidence of order execution, not profitability claims or an exhaustive test of all symbols and broker settings.

Official references: [TradingView strategy properties](https://www.tradingview.com/support/solutions/43000628599-strategy-properties/), [symbol minimum contract](https://www.tradingview.com/pine-script-docs/concepts/chart-information/), [strategy order sizing and execution](https://www.tradingview.com/pine-script-docs/concepts/strategies/), [higher/lower-timeframe requests](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/).
