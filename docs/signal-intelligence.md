# Signal Intelligence Integration

This module connects the Pine signal engine in [`backend/src/main/resources/pine/sniper-entry.pine`](/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/sniper-entry.pine) to the TradeJAudit backend and frontend.

## What stays in Pine

Pine remains responsible for chart-side detection and visualization:

- Sweep + displacement + order-block setup detection
- Standalone FVG mitigation detection
- HTF EMA bias filtering
- Session filtering
- Risk/reward projection and chart boxes
- Market regime detection (`TREND`, `RANGE`, `VOL_EXPANSION`, `VOL_COMPRESSION`)
- Timeframe/regime profile auto-selection
- Deterministic confidence scoring
- Bounded local adaptation from recent outcomes
- Structured `SIGNAL_OPEN` alert payload emission
- Optional simulated `SIGNAL_CLOSE` payload emission from Pine-side TP/SL tracking

Pine does not pull live decisions from the backend. Recommended profiles must be copied/applied manually in TradingView.

## What moves to the backend

TradeJAudit owns persistence, attribution, and learning:

- Webhook ingestion and validation
- Duplicate suppression and token validation
- Feature snapshot storage
- Outcome storage and trade linking
- Performance aggregates by symbol/timeframe/setup/regime/direction/profile
- Rules-based profile recommendations
- Weak-condition detection and reduced-confidence suggestions
- Diagnostics, analytics, today workflow, and settings UI

## Webhook flow

1. In TradeJAudit Settings, reset the TradingView webhook secret.
2. Paste that secret into the Pine input `Webhook Auth Token`, or keep it in the webhook URL query string.
3. In TradingView, create an alert using `Any alert() function call`.
4. Use the TradeJAudit webhook URL from Settings:
   - `POST /api/integrations/tradingview/signals/open`
   - `POST /api/integrations/tradingview/signals/close`
5. TradeJAudit stores the signal, feature snapshot, and optional outcome event.

## Payload contract

`SIGNAL_OPEN` includes:

- `schemaVersion`
- `eventType`
- `externalTradeId`
- `symbol`
- `timeframe`
- `timestamp`
- `barTime`
- `setupType`
- `direction`
- `entry`
- `stopLoss`
- `takeProfit`
- `rr`
- `confidenceScore`
- `regime`
- `htfBias`
- `session`
- `parameterProfileId`
- `features`
- `authToken`

`SIGNAL_CLOSE` includes:

- `schemaVersion`
- `eventType`
- `externalTradeId`
- `symbol`
- `timeframe`
- `timestamp`
- `result`
- `pnlR`
- `exitReason`
- `slippage`
- `holdBars`
- `holdMinutes`
- `authToken`

## Profile loop

Backend recommendations are stored as named packs such as `AUTO_15_TREND_V1`. Each pack carries:

- `swingLen`
- `minSweepAtr`
- `sweepRetrace`
- `dispBodyMin`
- `minFvgSizeAtr`
- `obSearchBars`
- `maxRiskAtr`
- `confidenceThreshold`
- `cooldownBase`
- `useObFvgConf`
- `useHtfBias`
- `sessionPreset`

TradeJAudit shows the recommended profile and rationale in Diagnostics, Analytics, and Today. The trader then manually selects `AUTO` in Pine or manually applies the values if using a custom profile.

## Notes and limits

- Pine-side close events are simulated from chart TP/SL logic. They are useful for validation but are not a replacement for linked journaled trades.
- Recommendation generation is rules-based today. The backend interfaces are prepared for later offline ML implementations.
- There is no server-to-Pine live inference loop. Any UI or process should keep that constraint explicit.
