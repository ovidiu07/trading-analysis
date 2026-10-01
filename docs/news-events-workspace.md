# Today: automatic News & Events

Implemented 2026-10-01 on the existing React/MUI/React Query + Spring Boot 3.2 / Java 21 / PostgreSQL stack. No deployment, purchase or new provider account is part of this change.

## Product and data boundaries

Today no longer renders Key levels or Session range. Native quote requests set `includeAnalysis=false`; the server skips candle analysis even when derivation is authorized. Stored private levels remain in session reviews and Ready history. No existing rows or columns are deleted. Instrument selection remains usable without quotes. Optional missing Treasury rows/cards disappear, and ECB daily FX references load only when Reference data is expanded. They never become live quotes or automatic risk conversions.

`GET /api/market-context?instrument=OANDA:DE30EUR&date=2026-10-01&timezone=Europe/Bucharest&window=SESSION` reads shared public cache only. It is authenticated but has no private account data and cannot write plans, briefing acknowledgements, or Ready captures. `window=LAST_24_HOURS` is explicit and only supported for the current session day. Optional `asOf=<UTC instant>` restricts first-seen snapshots. `POST /api/market-context/refresh?instrument=...` queues a shared refresh; it does not make an upstream call in the HTTP request.

The former events panel depended on translations in the published briefing selection. Automatic news and events now have independent persistence and queries. Editorial publication remains the existing reviewed, immutable flow. Personal thesis remains account-scoped preparation. No missing publication assigns an editorial Neutral bias.

## Enabled official coverage and verified sources

| Integration | Capability and exact scope | Authentication / history / reuse |
| --- | --- | --- |
| ECB press RSS | Headlines, original links and publication times for policy press releases, speeches and interviews. No signed-document excerpts. EU macro relevance for DAX and EURUSD. | No key. Rolling 15-item feed in the live response, no contractual archive or refresh SLA. [Feed directory](https://www.ecb.europa.eu/home/html/rss.en.html), [reuse conditions](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html). Attribution and free-source notice appear in the panel and pricing copy. |
| Federal Reserve monetary-policy RSS | Official policy announcements; US macro relevance. Not a general company-news service. | No key. Rolling 15-item live response. [Directory](https://www.federalreserve.gov/feeds/feeds.htm), [public-information policy](https://www.federalreserve.gov/disclaimer.htm). Official Board content only, no seals or third-party articles. |
| Eurostat economy/finance Atom | Official euro-indicator news, original summaries, publication and update timestamps. | No key; first page only (11 items in the live response), no automatic pagination. [Feed directory](https://ec.europa.eu/eurostat/web/rss), [commercial reuse and attribution](https://ec.europa.eu/eurostat/en/web/main/help/copyright-notice). Headlines/summaries retain their source language. |
| BLS iCalendar | Selected official US scheduled releases including CPI, employment and PPI where provided. | No key; [official calendar](https://www.bls.gov/schedule/). **Live request returned HTTP 403** from this machine. This is a fetch failure, not an empty calendar. [Public-domain policy](https://www.bls.gov/bls/linksite.htm). |
| BEA iCalendar | Scheduled GDP, personal income/outlays, and international trade releases. | No key. [Documented subscription](https://www.bea.gov/news/schedule/icalendar), [reuse policy](https://www.bea.gov/help/faq/147). Live parsing returned 119 events spanning 2025-01-07 through 2026-12-23. |
| Eurostat iCalendar | Tracked European inflation, GDP, employment, industrial production and retail releases. | No key; bounded one-off event parser. Live parsing returned 309 unique events. No inferred times for all-day items; unsupported recurrence or malformed content fails visibly. |
| BLS API v1 | Latest US unemployment rate `LNS14000000`, percent, seasonally adjusted; CPI-U all-items `CUUR0000SA0`, index 1982–84=100, not seasonally adjusted. Latest month and comparable preceding month. | No key. [API v1](https://www.bls.gov/developers/api_signature.htm), [25-query daily limit](https://www.bls.gov/developers/api_faqs.htm). Both automatic and existing admin BLS numerical requests share the new 20-request daily cap. |
| Eurostat statistics API | `une_rt_m`, `freq=M`, `s_adj=SA`, `age=TOTAL`, `unit=PC_ACT`, `sex=T`, `geo=EU27_2020`, latest two periods. Unit: percent of labour force. | No key. Dimensions and series are verified, not just HTTP status. [API update/version policy](https://ec.europa.eu/eurostat/data/web-services): dataset refreshes are delayed and latest-vintage. This is EU27, **not** a substituted euro-area series. |

Official feeds do not publish an unlimited-use availability guarantee or a common numerical request limit. The app uses conservative configurable ceilings, short responses and shared queries. Government/EU data reuse is source-attributed; no photos/logos or third-party paid article bodies are republished. Eurostat EU27 data is within the documented geographic commercial-reuse scope. ECB information is available free at the original source, including when the application itself is paid.

## Numerical release results versus statistical observations

The initial confirmed-release parser supports **euro-area HICP annual inflation**, percent year-on-year, not seasonally adjusted. It parses only the exact tested Eurostat Atom summary grammar beginning “The euro area annual inflation rate was …”, with explicit month/year and a matching named previous month. It never extracts numbers from headlines. An unrecognized wording remains a useful linked story, with no fabricated numerical fields. Publication and source-update timestamps come from Atom. The series identity is `EUROSTAT:HICP:EA:ANNUAL_RATE`, a documented application identifier for this published measure. [Eurostat adjustment basis](https://ec.europa.eu/eurostat/web/euro-indicators/information-data/consumer-housing-prices), [release/revision methodology](https://ec.europa.eu/eurostat/web/hicp/information-data).

The three statistics-API indicators above are displayed separately under **Verified statistical observations**, labelled latest-vintage retrospective data. They are never represented as instant releases, joined to calendar entries by guessed dates, or inserted into a historical session. Previous values use the preceding month with the same series, unit and adjustment. Missing cells stay null; zero remains a valid result. No official consensus forecasts are supplied. Revised-previous and forecast fields are supported but remain null unless sourced. Actual/forecast differences require matching series, period, unit and adjustment; no bullish/bearish sign is inferred.

A schedule passing its timestamp becomes Awaiting result until release evidence exists. Calendars are not proof of results. Released Eurostat announcements retain their own source identity rather than being guessed onto a calendar row. Thus a source schedule and a separate announcement may coexist. Application relevance is labelled as a TradeJAudit classification; no fabricated event-importance ratings are used.

## Marketaux candidate (disabled)

[Pricing](https://www.marketaux.com/pricing) was rechecked: free plan advertises 100 requests/day and 3 articles/request. [Documentation](https://www.marketaux.com/documentation) lists `/v1/news/all` on all plans, `api_token` authentication, date/search/entity filters and pagination. A date-filter parameter does not establish guaranteed free archive coverage. No economic-calendar or numerical-release capability is claimed.

[Public terms](https://www.marketaux.com/tos) do not establish authorization for this application's commercial redistribution/cache use. Therefore both written permission and `NEWS_MARKETAUX_AUTHORIZED=true` plus `NEWS_MARKETAUX_API_TOKEN` are required before its adapter makes requests. Written approval must cover public headline/link display, original-publisher attribution, shared caching and historical snapshot retention. No excerpts are displayed by this adapter. No credentialed live test was performed. The adapter implements two bounded shared topic queries (German equities and US technology), three results each, no pagination. Company-specific coverage remains limited; no broker CFD identifiers, constituent weights or membership assumptions are sent to this API. US exchange-qualified stocks retain exact identity and match only exact provider equity entities encountered in permitted topic results; this is not exhaustive company or earnings coverage.

## Mapping and history

`InstrumentTopics` groups GER40/DE40/DAX/OANDA:DE30EUR; NQ/MNQ/NAS100/US100/Nasdaq-100; EURUSD; GBPUSD; qualified NASDAQ/NYSE/AMEX stock symbols. It never changes chart/trade identifiers. DAX receives EU and major US macro, Nasdaq receives US macro plus authorized technology news. GBPUSD currently has US macro only; UK/BoE coverage is explicitly limited. Unknown instruments receive unsupported coverage, not keyword filler. NQ alone is not treated as a company-news search. Direct stock relevance requires a matching equity entity.

Session boundaries use IANA-zone local midnight and next local midnight converted to UTC, including 23/25-hour DST days. Article publication, source update, fetch attempt and last-success times remain separate. Browser render/query timestamps are not presented as provider updates. Instrument/date/window/as-of changes have separate React Query keys and abort signals; old responses cannot appear under the new selection.

V72 adds immutable `news_feed_snapshot`, shared `news_feed_state` and atomic `news_provider_budget`. Historical reads use only snapshots fetched by the cutoff, so archive coverage starts at installation. This deliberately does not backfill a historical session from a current RSS response, even if the headline is old. Ready review uses its existing `readyAt` cutoff. Cache updates cannot rewrite saved preparation. No as-of revision is reconstructed from an unversioned statistics API.

## Configuration, scheduler and budget

See `backend/news.env.example`; Docker Compose now passes these server-only settings. Existing user-edited root/frontend environment files were preserved.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `NEWS_ENABLED` | `true` | Runs official context jobs; false exposes paused coverage. |
| `NEWS_REFRESH_CRON` | `0 */5 * * * *` | Six-field Spring cron in UTC. Wakes due sources every five minutes. |
| `NEWS_OFFICIAL_DAILY_BUDGET` | `80` | Per-provider UTC-day ceiling shared by that provider's feeds. |
| `NEWS_BLS_DAILY_BUDGET` | `20` | BLS API cap; hard-clamped to 20 to retain 5 calls below the published 25/day limit. Shared with admin numerical imports. |
| `NEWS_MARKETAUX_AUTHORIZED` | `false` | Enable only after written display/cache permission. |
| `NEWS_MARKETAUX_API_TOKEN` | empty | Server secret; never included in API responses/browser bundles/logs. |
| `NEWS_MARKETAUX_DAILY_BUDGET` | `80` | Hard-clamped at 80; leaves at least 20 below the advertised free cap. |

Apply V72 using the existing Flyway startup. Keep an always-on Spring backend, as in the existing Docker deployment. The dedicated single-thread `newsScheduler` prevents HTTP waits delaying notification/session jobs; PostgreSQL leases fence concurrent instances. Existing jobs keep the configured default scheduling pool. This does not rely on browser timers or a serverless process surviving between invocations. On scale-to-zero/serverless hosting, an always-on worker or platform job invoking this service is still required; none is assumed here.

Normal daily requests, shared across every visitor/account/alias:

- ECB news: 48. Fed news: 48.
- Eurostat: 48 news + 4 calendar + 4 observations = **56** under its 80 cap.
- BEA calendar: 4. BLS calendar: 4 normally; 401/403 waits at least the feed's six-hour interval.
- BLS numerical API: 2 series × 4 = **8**, leaving 12 application slots for retries/admin work and 5 outside the app ceiling.
- Optional Marketaux: 2 topics × 24 = **48**, leaving 32 application slots for retries/manual refreshes, plus 20 unspent below the vendor cap.

Every HTTP attempt, including one permitted transient retry, consumes quota; no automatic pagination. A transient retry waits one second, then persistent failure uses shared backoff. HTTP 429 honors bounded Retry-After seconds or HTTP dates; 401/403 do not immediately retry. Connect/read timeouts are 4/6 seconds, bodies max 2 MB, and redirects are disabled. Manual refresh cannot bypass a 30-minute source cooldown, an active lease, a quota lockout or a failed-source backoff. A normal browser refresh only reads PostgreSQL.

These are bounded selected-source feeds, not a comprehensive global news terminal or complete economic calendar. Limits, freshness and historical gaps remain visible.

## Validation performed on 2026-10-01

- **101 focused backend tests passed** across `NewsContextTest` (16), `NewsFeedStoreTest` (3), `MarketWorkspaceServiceTest` (14), `SessionReviewServiceTest` (15), `SessionWorkspaceServiceTest` (16), `SessionBriefingSelectionTest` (17), and `OfficialEventPipelineTest` (20). Coverage includes source parsing, alias/entity rules, instrument identity, zero/null, comparable measurements, 23/25-hour session days, publisher/session date boundaries, same-day as-of, immutable history, 429/backoff, permission gates, and existing account isolation/Ready preservation.
- The three store tests ran against disposable **real PostgreSQL**, not a mock: 24 concurrent lease attempts yield one owner; 24 quota attempts with a seven-call cap yield seven reservations; expired workers cannot overwrite successors; failures retain earlier payloads; refresh respects backoff; snapshots reject mutation. Tests opt in with `NEWS_TEST_DB=jdbc:postgresql://localhost/tradevault_news_qa_<suffix>` and require the migrated `tradevault` schema.
- **32 frontend tests passed** across eight focused suites: news/events (5), context grid (1), ticker (2), published briefing (4), market API (2), workspace query lifecycle (9), Today preparation/Ready (4), and review recovery (5). The news race test resolves an aborted old instrument request after the new selection and confirms it cannot appear under the new instrument.
- TypeScript and production Vite build passed. Focused ESLint: zero errors, one existing `TodayPage` hook-dependency warning. Build retains its existing large-chunk warning. `git diff --check` and `docker compose config --quiet` passed (Compose retains its existing obsolete-version warning).
- `NewsProviderLiveTest`, explicitly enabled with `NEWS_LIVE_SMOKE=true`, exercised **nine real adapters: eight succeeded, one skipped after a real HTTP 403**. Parsed responses: ECB 15 stories; Fed 15; Eurostat 11 stories and two verified HICP releases; BEA 119 calendar events; Eurostat 309 unique calendar events; one verified observation each for BLS unemployment, BLS CPI, and EU27 unemployment. BLS calendar was blocked. These rolling response counts are an observed smoke-test result, not a future coverage promise. Fixtures captured for deterministic tests remain in `src/test/resources/news` only.
- The complete Flyway chain successfully migrated a fresh disposable database through **V72**. Normal application startup then failed at an existing Hibernate `asset.scope` enum type validation mismatch (database VARCHAR versus expected named enum). This unrelated schema issue remains unresolved. An isolated QA run using `--spring.jpa.hibernate.ddl-auto=none` started successfully; that override was **not** added to application configuration.
- On that isolated real application/database, authentication succeeded; anonymous context GET returned **401**, five instrument-context GETs returned **200**, historical and earlier same-day as-of GETs withheld all not-yet-fetched information, and refresh POST returned **202**. Seven cache reads left the provider-attempt counter unchanged (**9 → 9**). Current GER40/EURUSD each returned one matching news story, one scheduled event and three statistical observations. Nasdaq/GBPUSD/AAPL returned no matching session-day stories or events and two US statistical observations; BLS failure and UK/company limitations remained explicit. No production account/database was used.
- Browser QA used the actual React preparation components with clearly marked **fixture API responses**, plus the existing display-only chart widget. Verified desktop 1440×1000 and mobile 390×900, chart/context proportions, no document horizontal overflow, removed cards absent, news/event tabs, instrument switching, compact failures, Romanian diacritics and light/dark themes. These visual fixtures do not prove live API integration; the separate Java and authenticated HTTP tests above do. Temporary browser harness files were removed.

Screenshots: [`desktop-news.png`](../output/news-events-2026-10-01/desktop-news.png), [`desktop-events.png`](../output/news-events-2026-10-01/desktop-events.png), [`mobile-events.png`](../output/news-events-2026-10-01/mobile-events.png), [`mobile-ro-light.png`](../output/news-events-2026-10-01/mobile-ro-light.png).

Re-run deterministic backend suites with Java 21 and `mvn -f backend/pom.xml -Dtest=NewsContextTest,NewsFeedStoreTest,MarketWorkspaceServiceTest,SessionReviewServiceTest,SessionWorkspaceServiceTest,SessionBriefingSelectionTest,OfficialEventPipelineTest test`; without `NEWS_TEST_DB`, the PostgreSQL tests skip explicitly. Live smoke uses `NEWS_LIVE_SMOKE=true mvn -f backend/pom.xml -Dtest=NewsProviderLiveTest test` and consumes real upstream quota outside the application cache; do not schedule that test repeatedly. No deployment or production readiness is claimed by these local checks.
