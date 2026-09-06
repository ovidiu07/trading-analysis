# Today intraday workspace

Implemented in the existing React/MUI + Spring Boot/PostgreSQL application. No production deployment and no broker order execution are part of this change.

## Flow and persistence

Today retains Prepare / Trade / Review. Prepare has Session briefing, AI Market Coach, Select strategy and Chart analysis. Manual observation without a strategy is supported. Ready requires explicit context acknowledgement, chart confirmation and preparation confirmation; account risk calculations are unchanged.

V65 extends the existing append-only `session_review_revisions` identity to `(user, account, date, session_key, revision)`. Existing rows remain `DAY`; `EUROPE` and `US` are independent workspaces. Account locking and revision comparison reject stale writes with HTTP 409. Preparation, checklist, selected step, manual briefing selection, chart preferences and thesis are stored on the server. The browser's recovery copy is additional storage. Newer text entered during a pending save is retained and saved in the next revision.

Ready freezes its timestamp, preparation revision, strategy snapshot/version ID and complete briefing snapshot. Refresh creates another immutable briefing; it does not replace the Ready snapshot. Selecting another account or date remounts the correctly scoped workspace. Existing day-wide trade search still includes imported/retrospective executions.

`preparation_journals` links each workspace to one canonical Notebook note. Today writes both the note's text and editor HTML representation. `updatedAt` comparison and a row lock reject stale Today journal saves; retained text remains recoverable. The main Notebook editor also sends its expected timestamp and retains text typed during an in-flight save. Its save path takes a row lock and returns HTTP 409 on stale edits. Older API callers omitting the optional timestamp retain legacy behavior; this is not a universal concurrency migration of all historical notebook integrations.

Log trade embeds the existing `TradeForm`, uses the existing `TradeService.createManual`, defaults to OPEN, and stays on Today after saving. `preparation_trade_links` associates the execution with the exact review revision and records a request ID + payload for retry deduplication. A changed retry payload is rejected. Imported trades keep their existing import deduplication. A corrected account uses that account and does not inherit the original account's preparation. The existing trade-detail review dialog can retrieve the actual preparation linked to the execution.

## Briefing and market data

Product selection is evaluated in Europe/Bucharest: through 16:00 Asia; 16:00–16:15 keeps the prior choice; from 16:15 London. An explicit manual selection takes precedence and is persisted. Existing active workspaces are not switched on a clock tick.

Analysis windows are **09:00–15:00 Asia/Tokyo** and **08:00–16:00 Europe/London**. London ends at 16:00 for complete hourly bars; this is an analysis window, not a claim about exchange opening or closing hours. IANA timezone rules handle seasonal offsets. The date's end in Europe/Bucharest or the current instant, whichever is earlier, bounds historical data. Hourly bars whose closing timestamps exceed the reference are excluded. Weekend bars are excluded from these analysis windows. Each instrument falls back to its last window with observations and displays that actual data date; different instruments may have different dates. This is observed-data fallback, not a complete exchange holiday calendar.

The existing per-user OANDA credential integration supplies H1 candles for:

- GER40 → OANDA `DE30_EUR`, explicitly CFD.
- NAS100 → OANDA `NAS100_USD`, explicitly CFD.
- ES → unavailable unless the authorized feed supplies contract-specific `esHourly` data described below. No CFD substitute is presented as ES.

OANDA requests have a 5-second connect and 10-second read timeout. An initial briefing is persisted and reused on subsequent accesses; explicit refresh produces a new version. Every instrument reports source, observation date/time and availability. Completed hourly data is delayed/close, never described as a live quote. Very old observations become stale. Successful OANDA requests using an actual account credential were **not** verified in the local QA run.

### Range method

The deterministic calculation groups complete H1 candles into the chosen local-time analysis windows, uses up to 20 prior complete windows, and requires at least 14. It computes the mean of each window's `(high - low)`. The estimated envelope is `current window open ± mean width / 2`, with the width also expressed as a percentage of the opening reference. The horizon is the **whole analysis window**, not its remainder. The actual high/low already observed is shown separately. The source instrument, sample dates, count, opening reference and observation timestamp are retained. This is an uncalibrated descriptive envelope, not a confidence interval or statistically validated prediction.

### Optional ES futures OHLC

The same authorized feed can include `esHourly: {contract, source, url, bars}`. The contract must be an explicit ES expiry such as `ESU26`, never a continuous series. Every hourly bar requires the same `contract`, `time` (UTC opening instant), `availableAt`, and numeric `open`, `high`, `low`, `close`. Future, inconsistent, duplicate, mixed-contract or invalid OHLC bars are rejected. At most 2,000 bars are accepted. The existing deterministic window calculation then runs for that exact contract. Raw bars are removed before sending the derived briefing to AI. A licensed provider-side adapter is still required; no live ES source was available during QA.

### AI configuration

Set **both** `TODAY_OPENAI_API_KEY` and `TODAY_OPENAI_MODEL` on the server to enable the Responses API adapter. Choose a model supporting Structured Outputs. The adapter sends only the immutable market briefing; it never sends the private thesis, strategy customization or journal. A strict JSON schema describes per-symbol bias, rationale, primary and alternative scenarios, invalidation and risks. The server further checks symbol identity, allowed bias, text lengths and rejects numeric scenario levels; the numeric range stays owned by the deterministic calculation. Refusal, timeout, missing data and malformed results yield an explicit unavailable result. Output is bilingual Romanian/English. No model or key was configured in QA, so successful remote AI generation has **not** been verified.

### Optional authorized news/calendar/macro feed

No compatible news or economic-event provider was found in the existing application. A **normalized feed adapter**, not a turnkey Finnhub/FRED subscription, is provided. To connect a licensed feed or your own provider adapter, configure:

- `TODAY_MARKET_FEED_URL`: HTTPS endpoint.
- `TODAY_MARKET_FEED_TOKEN`: optional bearer token, server only.
- `TODAY_MARKET_FEED_DISPLAY_AUTHORIZED=true`: operator confirmation that the feed permits this display.

Requests contain `asOf` (UTC instant) and `session` (`ASIA` or `LONDON`), without user notes or identifiers. The response contract is an object containing `news`, `events`, and `macro` arrays. Every row requires `source`, HTTPS `url`, ISO-instant `time`, and **`availableAt`** (when that exact version of its content/values became available). The feed must provide point-in-time versions, including revised economic values; a current, revised historical value must not be backdated as historical knowledge.

- News: `title`, `relevance`. At most five recent items; timestamps must not exceed `asOf`. Weekend stories are labelled separately.
- Events: `title`, optional numeric `actual`, `forecast`, `previous`. Same-reference-day events are sorted chronologically. Future events omit `actual`; released and upcoming events are displayed separately.
- Macro: `name` from `Brent`, `WTI`, `DXY`, `US 2Y`, `US 10Y`, `DE 2Y`, `DE 10Y`; `benchmark`, numeric `value`, `unit`, `status`, optional numeric `referenceValue` and `referenceTime`. Yield units must be `%`; changes are `(value-referenceValue)*100` basis points. Bond futures prices are not a supported yield input. Include the specific oil benchmark in the source contract.

Live observations older than 5 minutes and delayed observations older than 30 minutes become stale; all observations older than four days become stale. Missing fields, future knowledge and unsafe URLs are excluded. The adapter has bounded timeouts and fails to unavailable. There is no configured, licensed feed in QA; news/calendar/macro delivery, market-specific freshness calibration and redistribution rights remain deployment dependencies. A provider-specific connector may still be required to produce this normalized contract.

## Mentor strategies

V66 seeds Trend continuation, Reversal and Range into the existing Mentor content tables and translations, not a second strategy model. Seeded content has context, execution rules, structural invalidation, management, no-trade criteria and an example; it makes no profitability claim. An administrator must exist. On a new installation without an administrator, use the **Initialize missing intraday Mentor templates** action in Admin after creating the administrator. The action is role-protected and idempotent.

Adoption creates a normal personal strategy using `StrategyService`, which generates its normal version history. A mapping prevents duplicate adoption and preserves personal archival. An archived copy requires explicit restoration. Global edits never overwrite personal copies. The existing Strategies page remains the personal editor/archive interface. Current seed rule text is English in both locale records; UI controls are translated EN/RO and template content remains editable through Mentor.

## TradingView

The existing Advanced Chart widget now has a concrete height at the actual iframe ancestor, full standard toolbars, 70dvh normal / 85dvh expanded sizing and a 420px minimum. A searchable multi-select accepts DAX, NASDAQ-100, ES and custom instrument labels. Symbol/timeframe selection persists with preparation. Text editing does not recreate the widget. Theme changes and step/tab remounts recreate it as required by the external widget.

Verified quick symbols: `OANDA:DE30EUR` and `OANDA:NAS100USD` for CFD charts; `CME_MINI:ES1!` identifies the continuous ES contract, but the embedded widget rejected it as available only on TradingView. Selecting ES therefore shows an explicit limitation and a direct TradingView link, not an empty iframe or CFD replacement. `XETR:DAX` was tested and is EOD-only in this widget; it is therefore not the intraday default. Numeric CFD levels are not transferred to a cash index or futures contract. Chart timezone remains the instrument/exchange timezone and is labelled separately from the account timezone.

Pine import and account/indicator synchronization are unavailable. Users can open the exact symbol on TradingView for personal indicators. Advanced Charts custom indicators require JavaScript implementation and an appropriate licensed library/datafeed; Advanced Charts does not run Pine. Drawing/layout synchronization is not implemented. A TradingView script error was observed during development remount/HMR; the normal OANDA chart subsequently rendered with candlesticks, interval controls and drawing tools. Third-party widget delivery is not under application control.

References: [widget FAQ](https://www.tradingview.com/widget-docs/faq/general/), [custom studies](https://www.tradingview.com/charting-library-docs/latest/custom_studies/), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Local validation, 6 September 2026

- Java 21: 21 focused backend tests passed, zero failures/errors/skips. Classes: SessionReviewServiceTest, BriefingMathTest, LicensedBriefingFeedTest, StrategyServiceTest, NotebookNoteConflictTest.
- Frontend: 39 tests passed across eight selected files; 10 pre-existing SessionPage tests remain skipped. Production build passed. ESLint: zero errors, 16 existing warnings. EN/RO audit: 3,771 keys each, zero missing keys; the broad hardcoded-text audit still reports 271 candidates.
- Fresh isolated PostgreSQL database: all Flyway migrations through V66 applied. Authenticated synthetic admin/user checks: 25 Today API checks, eight Mentor authorization/personalization/seed checks, five cross-editor Notebook conflict checks passed. These use real local persistence and HTTP; market providers were unconfigured.
- Authenticated local browser: preparation, Ready, OPEN trade logging without an exit, journal autosave/refresh, Review and actual OANDA widget rendering checked. Page-width measurements passed at 360/390/768/1280/1440 pixels in EN dark, RO light and RO dark. The final instrument multi-select was build/unit validated after this browser pass. See `outputs/today-prepare-verification/browser-checks.json` for exact scope and limitations.
- No hosted verification, full keyboard-only audit, successful paid/licensed market feed, authenticated real OANDA market request or remote OpenAI generation was performed. This is not evidence that every requested provider-backed feature is operational. The fresh local QA database and synthetic identities are separate from the existing local application data.
