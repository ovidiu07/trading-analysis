# TradeJAudit market data source boundaries

## Current local behavior

The authenticated Today Prepare screen does not present fixture values as market data. OANDA quotes are implemented behind a server-side display-authorization gate that defaults off. The official Treasury yield adapter is implemented as a daily public reference. Completed-candle daily open, prior daily references, change percentage, and Asia/London range calculations are connected to the selected-instrument response, but remain unavailable unless a second rights gate is explicitly enabled. No implementation change constitutes production authorization for OANDA.

Semantic levels use the preparation's captured published briefing when present, and the selected published revision otherwise. Current-day Prepare separately refreshes the latest administrator-published event selection every 30 seconds while visible, sharing BriefingPanel's selection query. This labelled events update does not change the acknowledged capture, editorial levels or Ready/history. Historical Prepare events retain the captured publication. Drafts and official import suggestions are not exposed to Today. Today event timestamps are rendered in the workspace display timezone, alongside the original source timezone; date-only official schedules explicitly have no verified hour. Cancelled events retain their status. Actuals require a verified past publication time and must have been available by the briefing reference time; forecasts and previous values require reviewed source attribution. Impact is optional editorial metadata and is never inferred. Typed semantic levels remain administrator entered, source attributed and instrument-specific.

The [official event pipeline](official-event-pipeline.md) adds admin-reviewed BLS/Eurostat calendar and exact-observation suggestions with immutable source history. It never publishes automatically and does not update frozen Ready/history compositions.

## Source classes and gates

| Class | Intended use | Current state |
| --- | --- | --- |
| `USER_CONNECTED` | Individual user's own connected-provider data, visible only to that user | Practice/Live connection, discovered account instruments, batched account-scoped quotes, and per-user memory cache are implemented; display gate defaults off |
| `OFFICIAL_PUBLIC` | Official schedules and published statistics with source, retrieval and observation dates | U.S. Treasury 2Y/10Y daily observations and same-source basis-point changes are implemented; never labelled Live |
| `EDITORIAL_PUBLISHED` | Immutable, administrator-published V67 briefing revisions | Captured levels/history; latest reviewed events in current-day Prepare, with an explicit update boundary |
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

The quote cache is process-local and bounded to 256 entries. Keys include user, workspace account, provider account, environment, encrypted-credential version, and discovered symbol set. Selected-instrument analysis is composed separately on every response. Successful batches expire after 1.2–5 seconds; failed batches back off for 15 seconds (60 for rate limiting). Credential lookup happens before cache lookup, so a disconnected account cannot reuse a cached quote. Neither tokens nor native prices are shared between users. Responses use `Cache-Control: no-store`.

The authenticated Today client polls in Prepare every five seconds while visible, cancels on hide/unmount, removes cached values on user switch/logout and connection changes, and resumes on visibility/network recovery. A successful HTTP response is the application heartbeat; this is a bounded REST batch, not a provider stream. Unavailable data polls every 30 seconds, upstream failures every 15 seconds, rate limits every 60 seconds, and transport errors use exponential backoff capped at 60 seconds. Retained prices become stale and their numeric values are hidden after a failed heartbeat or 15 seconds without one; provider observation age also expires at 15 seconds, including cached responses. Access denial removes numeric values. Provider discovery and quote fetches use the existing per-user request limiter. Provider safe GETs retry once with jitter for transient failures; an in-process, host-scoped circuit opens after repeated failures. Horizontal instances do not share cache, limiter, or circuit state; aggregate IP-level quotas still need deployment-level capacity review before activation.

The native cards show source, exact provider symbol, instrument type, price basis, units, observation time, freshness, and availability reason, with a provider-settings link. TradingView remains a visibly separate display-only chart. Candidate FX, metal and CFD symbols are used only if present in that user's account capabilities; `DXY` and `ES` have no native mapping or substitute. Arbitrary stock, ETF, cash-index and futures chart symbols do not fall back to a native CFD selection.

The batch adapter uses the current `tradeable` boolean, with the deprecated status only as a compatibility fallback. As defined in OANDA's [pricing schema](https://developer.oanda.com/rest-live-v20/pricing-df/), closeout bids/asks are position-closing prices when normal liquidity is absent, not official session closes. Their midpoint is explicitly labelled `CLOSEOUT_MID`, never Live, and is not used for MID-basis change calculations. Invalid, crossed, nonpositive and future-dated prices are rejected.

The V69 migration adds the allowlisted OANDA environment, discovered instrument capabilities, and their refresh timestamp. Capability discovery refreshes on connection and at most every 24 hours. Ready captures source, provider symbol, basis, observation/retrieval time, freshness, provenance, and availability metadata only. Bid, ask, midpoint, yield values, and other numeric market values are omitted from the Ready snapshot. The exact published briefing composition remains frozen as before.

Native watchlist reads use a single credential/account/environment snapshot and refresh expired capabilities in a bounded per-user memory cache, without saving credentials or capability rows. Failed discovery does not fall back to expired capabilities. Disabling display authorization prevents token decryption, account discovery, quotes and candle analysis through the native workspace path. Display authorization alone does not enable candle-derived metrics.

### OANDA authorization review — 2026-09-25

Rechecked the official [account instrument endpoint](https://developer.oanda.com/rest-live-v20/account-ep/) and [development guide](https://developer.oanda.com/rest-live-v20/development-guide/). Account discovery establishes technical instrument access, not display rights. The guide documents 120 REST requests per second and two new connections per second per IP; the local per-user limiter is not a substitute for aggregate deployment controls.

The current [OANDA Corporation API License Agreement](https://legal.oanda.com/oc/api_license_agreement_oc/en) is dated August 2026. Its Internal Use definition excludes clients/customers; section 3.2 restricts use to internal purposes, and section 13 requires prior written permission for redistribution/retransmission. Also reviewed the official [Asia Pacific agreement](https://www.oanda.com/assets/documents/714/API_License_Agreement_OAP.pdf) and located the [Europe Markets agreement](https://www.oanda.com/assets/documents/1276/OEM_OANDA_API_Licence_v3_07.2022.pdf). A connected token/account does not identify the applicable contracting entity or provide a written TradeJAudit display grant. No qualifying authorization is recorded in this workspace. Both existing display and candle-derived-data gates remain default-off and were not enabled by this implementation. Before enabling either, record the user's applicable entity/agreement and explicit authorization covering this application's customer display, temporary caching and, separately, derived-data use. No account was created, token collected, or production configuration changed in this implementation.

Local operations settings are listed in `.env.example`. Keep both OANDA market-data gates `false` until authorization is documented. The Treasury base URL accepts only HTTPS on `home.treasury.gov`; its cache duration is operator-configurable.

Still pending: exact written OANDA authorization; authenticated browser verification; successful live BLS calendar connectivity; a normalized operator feed; sanitized market-data metrics/active-client instrumentation; and verification at requested browser breakpoints and both themes. The separate `MARKETDATA_OANDA_CANDLE_DERIVATIONS_AUTHORIZED` gate defaults off and must not be enabled until candle retrieval, temporary caching, and derived display are authorized. The Treasury provider is implemented but live upstream connectivity could not be confirmed from this environment during the current run.

Fresh-database validation applied all migrations through V69. A normal application start with `spring.jpa.hibernate.ddl-auto=validate` then stopped on the existing `asset.scope` PostgreSQL enum mapping (`asset_scope` reported as JDBC VARCHAR while the mapping expects NAMED_ENUM). With JPA schema validation disabled for the isolated local smoke check, the application started and the new endpoint returned 401 without authentication. No authenticated test account/session was available in that isolated database, so authenticated browser behavior remains unverified.

## Today integration verification (2026-09-25)

Native display validates the exact provider identity, USER_CONNECTED provenance, MID basis and observation age. Closed/closeout, stale and denied values are unavailable with their reason; provider settings remain linked. Completed references stay separate and accept only explicit `complete: true` candles whose response instrument and granularity match the request, consistent with the [OANDA candle schema](https://developer.oanda.com/rest-live-v20/instrument-df/). Neither API access nor this schema enables either authorization gate. Ready sanitization rejects display-only provenance and retains metadata only.

The events action opens and focuses Market Context, including keyboard activation. EN/RO event details include local time, original source timezone and retrieval/publication timestamps. Treasury remains an official daily observation regardless of an erroneous upstream live flag. See [integration validation](today-market-integration.md) for local evidence and remaining deployment boundaries.


## Private levels and optional native data (2026-09-25)

Private manual levels now live in the existing account/session preparation revisions. They are keyed by the full selected chart identity (for example `OANDA:DE30EUR`, not the ambiguous display name DAX), server-stamped as MANUAL with author and update time, and are never populated from TradingView. Editing one instrument preserves the others. Ready retains its original copy; history renders each revision's own levels. No native connection is required to enter levels. Manual values do not automatically populate risk/order inputs.

The scoped ECB daily-reference card is independent of provider connections and is not a native quote. EIA released petroleum-stock observations use the reviewed-event flow. Both existing OANDA authorization gates remain default-off; ES, DXY and unmapped instruments have no native substitutes. See [free official context implementation and validation](free-official-context.md).
