# Devtrader – Chart Analysis

**Devtrader – Chart Analysis** is a multi-layer market-context indicator built to help discretionary traders read liquidity, market structure, session timing, higher-timeframe context, and fair value gaps from one chart.

The indicator follows a narrative-based workflow:

**liquidity location → raid or sweep → reclaim → structure confirmation → continuation or invalidation**

It is designed as an analysis and decision-support tool. It does not place orders, manage positions, promise future price direction, or generate automatic buy and sell signals.

## Main features

- **Liquidity map:** identifies and ranks buy-side liquidity (BSL) and sell-side liquidity (SSL) from confirmed swings, session levels, previous-period levels, and optional higher-timeframe levels.
- **Sweep engine:** evaluates liquidity raids using penetration, reclaim, rejection efficiency, sweep depth, volume, session context, and level quality filters.
- **Market structure:** displays confirmed swing points, Change of Character (CHoCH), Break of Structure (BOS), protected levels, and Inducement (IDM) events.
- **Session context:** tracks Asia, London, and New York windows, with optional developing session highs and lows.
- **Higher-timeframe context:** combines two configurable higher timeframes to provide directional context and inject confirmed HTF liquidity into the active chart.
- **Important market levels:** optionally displays the previous day, week, and month highs/lows, previous close, daily open, and New York midnight open.
- **Fair Value Gaps:** detects bullish and bearish FVGs on the chart timeframe or a configurable higher timeframe, tracks mitigation, and supports static or dynamic rendering. Optional tiny text inside each static box shows its size in pips and percent. An optional percentage line marks an editable depth from the retest edge.
- **Adaptive rendering:** offers full, compact, and right-side-only level layouts, together with label-clutter controls for cleaner charts.
- **Trader Dashboard:** summarizes current bias, nearby liquidity, the active event, structure state, session timing, and a plain-language contextual read.

## Understanding the dashboard

- **Bias** combines higher-timeframe context, current structure, and protected-level integrity.
- **Liquidity** highlights the most relevant BSL and SSL currently surrounding price.
- **Event** reports the active narrative, such as a pending raid, confirmed sweep, CHoCH, BOS, breakout, or failed reclaim.
- **Structure** describes the current market-structure condition and confirmation stage.
- **Timing** shows the active session context and whether a long or short narrative is being monitored.
- **Read** translates the current conditions into a scenario to monitor. It is contextual guidance, not an entry instruction.

## Suggested workflow

1. Start with the **Bias** and **Structure** rows to understand the broader directional context.
2. Use the liquidity map to identify the BSL or SSL that price may interact with next.
3. Wait for the sweep engine to distinguish a qualified reclaim from a simple breakout or failed rejection.
4. Look for post-sweep confirmation through an internal shift, CHoCH, BOS, or damage to the opposing protected level.
5. Use FVGs, session timing, and important market levels as additional confluence for your own execution and risk plan.

No single label should be used in isolation. A sweep is an event, not automatically a trade, and a directional dashboard read is not a guarantee that price will continue in that direction.

## Key settings

- Use **External Liquidity Only** for a stricter view focused on major, session, and HTF liquidity. Disable it to include more internal structure.
- Choose **Aggressive**, **Balanced**, or **Conservative** market-structure confirmation according to the amount of confirmation you want.
- Adjust the reclaim, rejection, penetration, depth, volume, and timeout controls to suit the instrument and timeframe.
- Configure the session times for the exchange, instrument, and timezone you trade.
- Use the rendering and clutter settings to control how much historical and right-side chart information is displayed.

## FVG dimensions

Under **Fair Value Gaps**, enable **Show FVG Dimensions** to display a compact
annotation such as **12.5 pips · 0.0568%** inside each bullish or bearish static
FVG box. The option is **disabled by default**. Text is tiny, right-aligned,
vertically centered, and uses the existing chart-theme text color with a subtle
fade. It wraps within narrow boxes; very small boxes may clip the text.

The values describe the original gap, so they stay fixed as price moves:

- **Pips** = (upper boundary − lower boundary) / pip size.
- **Percent** = (upper boundary − lower boundary) / absolute lower boundary × 100,
  matching the detection threshold for positive prices. A zero lower boundary
  displays `n/a` for the percentage.

**FVG Pip Size (0 = Auto)** selects the price units represented by one displayed
pip. Auto uses 0.0001 for Forex, 0.01 for JPY quotes, 0.00001 for JPY base pairs,
and 1.0 price unit for other instruments, so an index uses one point per pip.
Set a positive value to match a different broker convention, such as 0.1 or 0.01.
This is a display convention; it does not change the symbol's tick size.

Both time-based and bar-index boxes support the annotation. The text belongs to
the box and disappears with it on mitigation or record trimming, without adding
label objects. Formatting runs only for surviving active boxes on the latest
bar. Dynamic mode uses fills instead of boxes, so set **Dynamic** off
to show dimensions. The option has no effect on detection, mitigation, alerts,
or the optional percentage line.

## FVG percentage line

Under **Fair Value Gaps**, enable **Show FVG Percentage Line** to draw a horizontal
reference across each static FVG box. It is **disabled by default**, with
**FVG Line Percentage = 25%**. The percentage accepts decimal values from 0 to 100.

The percentage starts at the retest edge:

- Bullish gap: 0% is the top; the line moves downward toward the bottom.
- Bearish gap: 0% is the bottom; the line moves upward toward the top.
- 50% is the midpoint; 100% is the opposite edge.

For a gap from 100 to 120, 25% marks **115 for a bullish gap** and **105 for a
bearish gap**. Line colors, width, and solid/dashed/dotted style are editable.
The line spans the same horizontal anchors as its box and is removed with the
box on mitigation or active-record trimming. It is a display reference and has
no effect on gap detection, mitigation, alerts, or other indicator calculations.
Dynamic mode draws fills instead of boxes, so this box-only line is hidden there.

## Defaults captured on 13 October 2026

Input defaults match the active **Devtrader Chart Analysis** indicator on the
**Devtrader-BlackV1** TradingView desktop layout. The complete 123-input code
preset (117 existing inputs plus six new percentage-line inputs) is recorded in
`devtrader-chart-defaults-2026-10-13.json`.
This historical snapshot predates the two FVG dimension inputs described above.

The configured session input values are Asia **00:00–09:00**, London
**10:00–16:00**, and New York **16:30–23:00**. The existing code interprets these
session inputs in **UTC**; that behavior is preserved. The sweep qualification
windows retain their existing London/New York time zones.

Other active preferences include CHoCH/BOS display off, Trader Dashboard off,
previous-week high/low on, right-side-only level rendering, width 2 for active and
passive levels, Small level/structure labels, and the existing theme colors and
transparencies. FVG defaults are **0.04% threshold, Auto off, chart detection
timeframe, Extend 20, Dynamic off, time-based objects on, 80 active records, and
30% box opacity**. All native interval visibility categories remain enabled.

## Alerts

The script provides alert conditions for:

- confirmed liquidity sweeps;
- market-structure confirmation after an active sweep;
- new bullish and bearish FVGs;
- bullish and bearish FVG mitigation.

For stable alert behavior, consider configuring alerts **Once Per Bar Close**.

## Important behavior

Market-structure swings are based on confirmed pivots. They are plotted on the historical pivot bar only after the required right-side bars have completed, so they intentionally appear with a confirmation delay. Higher-timeframe context uses previous confirmed candles and confirmed pivots without future lookahead. Developing levels, FVGs, and conditions evaluated on the current real-time candle can still change before their source candle closes.

Results will vary by market, timeframe, session configuration, liquidity, and volatility. Users should validate their settings and interpretation through replay, forward observation, and independent testing.

## Disclaimer

This indicator is provided for educational and informational purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any financial instrument. Trading involves substantial risk, and past market behavior does not guarantee future results. You are solely responsible for your trading decisions and risk management.
