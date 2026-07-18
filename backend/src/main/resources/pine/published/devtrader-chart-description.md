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
- **Fair Value Gaps:** detects bullish and bearish FVGs on the chart timeframe or a configurable higher timeframe, tracks mitigation, and supports static or dynamic rendering.
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
