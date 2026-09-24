# TradeJAudit market data source boundaries

## Current local behavior

The authenticated Today Prepare screen does not present fixture values as market data. OANDA quotes are implemented behind a server-side display-authorization gate that defaults off. The official Treasury yield adapter is implemented as a daily public reference. Completed-candle daily open, prior daily references, change percentage, and Asia/London range calculations are connected to the selected-instrument response, but remain unavailable unless a second rights gate is explicitly enabled. No implementation change constitutes production authorization for OANDA.

Upcoming events and semantic levels are read from the existing `/api/session-briefings` selection for the requested editorial date. Only its selected, published revision is used. Draft editorial content is not exposed by this endpoint. Event timestamps are rendered in `Europe/Bucharest`; the event's source timezone is shown alongside the time. Cancelled events remain visible with their cancelled status. Actual, forecast, and previous values are rendered only for a released event whose scheduled time has passed. Impact is optional editorial metadata; the UI does not infer impact from an event name. Typed semantic levels are optional and backward-compatible, administrator entered, source attributed, instrument-specific, and displayed only for the exact selected canonical instrument.

## Source classes and gates

| Class | Intended use | Current state |
| --- | --- | --- |
| `USER_CONNECTED` | Individual user's own connected-provider data, visible only to that user | Practice/Live connection, discovered account instruments, batched account-scoped quotes, and per-user memory cache are implemented; display gate defaults off |
| `OFFICIAL_PUBLIC` | Official schedules and published statistics with source, retrieval and observation dates | U.S. Treasury 2Y/10Y daily observations and same-source basis-point changes are implemented; never labelled Live |
| `EDITORIAL_PUBLISHED` | Immutable, administrator-published V67 briefing revisions | Used for the Today event card through the existing selected-publication endpoint |
| `LICENSED_OPERATOR` | A normalized commercial feed with explicit endpoint configuration and display authorization | Disabled / not implemented |
| `DISPLAY_ONLY` | TradingView chart or external link | Chart remains an independent display feed; it is not a source for native metrics, calculations, or history |

OANDA's developer guide currently documents separate Practice and Live REST hosts and an account pricing endpoint that accepts a comma-separated instrument list. The pricing stream documentation describes conflated prices, at most four prices per second per instrument, rather than every created price. Those facts do not grant redistribution rights. The linked OANDA Asia Pacific API License Agreement restricts third-party display/disclosure and redistribution in its text; obtain written authorization covering the precise TradeJAudit workflow before enabling customer display. This project must keep any future operator gate disabled until that review is recorded.

Candidate aliases such as `GER40` to `DE30_EUR` and `NAS100` to `NAS100_USD` must be treated only as candidates. A user's exact provider account instrument list must authorize the mapping before use. Do not substitute an unrelated CFD, cash index, ETF, future, or currency basket for unsupported `ES` or `DXY`.

## Calculation conventions for future providers

- OANDA daily candles must send an explicit `dailyAlignment` and `alignmentTimezone`; do not rely on the OANDA API defaults (17:00 / `America/New_York`).
- The OANDA candle request explicitly uses daily alignment `17:00 America/New_York`. The analysis-window contract is Asia `09:00–15:00 Asia/Tokyo`; London `08:00–16:00 Europe/London`. These are not exchange trading hours. Only completed candles may form a range. Completed-bar calculations are cached per user/workspace/provider account/environment/symbol/date for two minutes in process memory and are never persisted as candle rows by this feature.
- Current price and completed-candle references are separate observations. A percentage change requires the current midpoint and the previous completed close for the same provider, provider symbol, price basis, and alignment convention.
- Treasury rates are shown as official daily close/reference observations with an observation date, same-source previous observation, basis-point change, retrieval timestamp, and source link. They are never live quotes. Requests are server-side and cached for twelve hours; response parsing disables external entities and rejects payloads over one megabyte.
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

The quote cache is process-local, user/workspace/provider-account/environment/selected-symbol/date/symbol-set scoped, and expires after roughly one second. The authenticated Today client polls every two seconds only while visible, cancels on hide/unmount, and clears its cache on logout. Provider safe GETs retry once with jitter for transient failures; an in-process, host-scoped circuit opens after repeated failures. Horizontal instances do not share this cache or circuit state.

The V69 migration adds the allowlisted OANDA environment, discovered instrument capabilities, and their refresh timestamp. Capability discovery refreshes on connection and at most every 24 hours. Ready captures source, provider symbol, basis, observation/retrieval time, freshness, provenance, and availability metadata only. Bid, ask, midpoint, yield values, and other numeric market values are omitted from the Ready snapshot. The exact published briefing composition remains frozen as before.

Local operations settings are listed in `.env.example`. Keep both OANDA market-data gates `false` until authorization is documented. The Treasury base URL accepts only HTTPS on `home.treasury.gov`; its cache duration is operator-configurable.

Still pending: exact written OANDA authorization; authenticated browser verification; user-entered preparation-plan levels (there is no canonical persisted level field there); optional official BLS calendar staging/import; a normalized operator feed; sanitized market-data metrics/active-client instrumentation; and verification at requested browser breakpoints and both themes. The separate `MARKETDATA_OANDA_CANDLE_DERIVATIONS_AUTHORIZED` gate defaults off and must not be enabled until candle retrieval, temporary caching, and derived display are authorized. The Treasury provider is implemented but live upstream connectivity could not be confirmed from this environment during the current run.

Fresh-database validation applied all migrations through V69. A normal application start with `spring.jpa.hibernate.ddl-auto=validate` then stopped on the existing `asset.scope` PostgreSQL enum mapping (`asset_scope` reported as JDBC VARCHAR while the mapping expects NAMED_ENUM). With JPA schema validation disabled for the isolated local smoke check, the application started and the new endpoint returned 401 without authentication. No authenticated test account/session was available in that isolated database, so authenticated browser behavior remains unverified.
