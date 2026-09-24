# TradeJAudit market data source boundaries

## Current local behavior

The authenticated Today Prepare screen must not present fixture values as market data. Its watchlist and native levels/ranges/cross-market cards currently report **Unavailable** until each provider path is implemented, account-scoped, and authorized for display. No change here constitutes production authorization or a connection to OANDA or Treasury.

Upcoming events are read from the existing `/api/session-briefings` selection for the requested editorial date. Only its selected, published revision is used. Draft editorial content is not exposed by this endpoint. Event timestamps are rendered in `Europe/Bucharest`; the event's source timezone is shown alongside the time. Cancelled events remain visible with their cancelled status. Actual, forecast, and previous values are rendered only for a released event whose scheduled time has passed. Impact is optional editorial metadata; the UI does not infer impact from an event name.

## Source classes and gates

| Class | Intended use | Current state |
| --- | --- | --- |
| `USER_CONNECTED` | Individual user's own connected-provider data, visible only to that user | OANDA display/use authorization and account capability discovery are not implemented; no native OANDA quote is displayed |
| `OFFICIAL_PUBLIC` | Official schedules and published statistics with source, retrieval and observation dates | Treasury adapter is not implemented; US 2Y/10Y remain unavailable |
| `EDITORIAL_PUBLISHED` | Immutable, administrator-published V67 briefing revisions | Used for the Today event card through the existing selected-publication endpoint |
| `LICENSED_OPERATOR` | A normalized commercial feed with explicit endpoint configuration and display authorization | Disabled / not implemented |
| `DISPLAY_ONLY` | TradingView chart or external link | Chart remains an independent display feed; it is not a source for native metrics, calculations, or history |

OANDA's developer guide currently documents separate Practice and Live REST hosts and an account pricing endpoint that accepts a comma-separated instrument list. The pricing stream documentation describes conflated prices, at most four prices per second per instrument, rather than every created price. Those facts do not grant redistribution rights. The linked OANDA Asia Pacific API License Agreement restricts third-party display/disclosure and redistribution in its text; obtain written authorization covering the precise TradeJAudit workflow before enabling customer display. This project must keep any future operator gate disabled until that review is recorded.

Candidate aliases such as `GER40` to `DE30_EUR` and `NAS100` to `NAS100_USD` must be treated only as candidates. A user's exact provider account instrument list must authorize the mapping before use. Do not substitute an unrelated CFD, cash index, ETF, future, or currency basket for unsupported `ES` or `DXY`.

## Calculation conventions for future providers

- OANDA daily candles must send an explicit `dailyAlignment` and `alignmentTimezone`; do not rely on the OANDA API defaults (17:00 / `America/New_York`).
- If a future implementation uses the existing analytics window contract, label these as TradeJAudit analysis windows: Asia `09:00–15:00 Asia/Tokyo`; London `08:00–16:00 Europe/London`. These are not exchange trading hours. Only completed candles may form a range.
- Current price and completed-candle references are separate observations. A percentage change requires the current midpoint and the previous completed close for the same provider, provider symbol, price basis, and alignment convention.
- Treasury rates should be described as official daily close/reference observations with an observation date, never as live quotes. The direct U.S. Treasury XML feed is the intended first source; this workspace currently makes no browser-direct Treasury requests.
- TradingView widget output is display-only. Never read, scrape, OCR, intercept, export, or reconstruct its values into TradeJAudit native data.

## Official references reviewed 2026-09-24

- OANDA pricing endpoint: <https://developer.oanda.com/rest-live-v20/pricing-ep/>
- OANDA development guide and environments / rate limits: <https://developer.oanda.com/rest-live-v20/development-guide/>
- OANDA API License Agreement (OAP): <https://www.oanda.com/assets/documents/714/API_License_Agreement_OAP.pdf>
- TradingView widget data FAQ: <https://www.tradingview.com/widget-docs/faq/data/>
- U.S. Treasury daily interest-rate XML feed: <https://home.treasury.gov/treasury-daily-interest-rate-xml-feed>
- BLS calendar: <https://www.bls.gov/help/hlpiCAL.htm>
- BLS API features and terms: <https://www.bls.gov/bls/api_features.htm>, <https://www.bls.gov/developers/termsOfService.htm>
- CME market-data licensing: <https://www.cmegroup.com/market-data/license-data.html>

## Operational status

No market-data batch service, per-environment OANDA credential model, account capability cache, quote polling lifecycle, official Treasury adapter, or source-aware Ready market snapshot is present in this implementation. Do not claim those controls or market-data production readiness based on the UI behavior described above. Database migration `V69` was therefore not added; the optional event impact field is backward-compatible JSON contract metadata and requires no schema change.
