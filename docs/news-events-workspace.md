# TradeJAudit Market Context: news and Tradays calendar

Local implementation updated 2026-10-01. **Partial delivery: the full Tradays calendar and custom warning requirement is not operational.** The official widget is integrated, but supported/authorized structured event access and enforceable widget timezone/filter settings remain unresolved. No deployment, purchase, account creation, provider contact or production change was performed.

## Integrated application behavior

The existing Today → Prepare → `MarketIntelligenceGrid` → `NewsEventsPanel` path now presents News and Calendar tabs. Published editorial briefings and private preparation remain separate. No Key Levels or Session Range cards were restored. News profile changes do not write chart symbols, instruments, account scope, acknowledgements or plans.

News uses the selected session day by default, with an explicit current-day last-24-hours option, six initial items and Show more. Each item identifies its publisher, original publication time, relevance category and original link. Marketaux is identified separately as the aggregator; its excerpts/images are not republished. Shared fetch times appear in source coverage, never as publication times. Official announcements/statistical observations remain in a separately labelled disclosure under News; they cannot drive Tradays warnings.

Query keys include instrument, date, timezone, window and as-of. Requests are abortable and responses are checked against the active identity/date/window/timezone. Instrument changes preserve the calendar instance/tab. Historical, future/non-current and saved-as-of views do not load a live Tradays iframe or show present-time warnings. Local clock ticks and focus/visibility resume update eligibility; local session midnight removes live eligibility even if the parent has not yet advanced its selected date.

## Tradays: verified public interface and unresolved requirements

Official sources reviewed: [widget builder](https://www.tradays.com/en/widget), [help](https://www.tradays.com/en/help), [project description](https://www.tradays.com/en/about), [terms](https://www.tradays.com/en/terms).

The public builder was inspected live. It exposes current day/week, autosize or dimensions, language, date format, and light/dark theme. Generated HTML for current day/English/autosize has `mode:"1"`, `width:"100%"`, `height:"100%"`, `fw:"html"`, `lang:"en"`; dark theme adds `theme:1`. The generated script is `https://www.tradays.com/c/js/widgets/calendar/widget.js?v=15`. The supplied widget markup and MQL5 attribution remain unchanged inside an isolated document. TradeJAudit styles the surrounding panel/document only. No widget implementation, iframe content or private request is read, proxied, cached, intercepted or reverse-engineered.

The language picker exposes EN/RU/DE/PT/ES/ZH/JA/AR/TR; Romanian is absent. The surrounding app has EN/RO translations and Romanian diacritics; the embed is explicitly English. An iframe title and keyboard-operated application tabs are supplied, but the app cannot guarantee or modify the provider's internal accessibility.

| Requested behavior | Evidence / current status |
| --- | --- |
| Current-day display | Official builder supports day mode; live embed rendered it. The day follows provider behavior, not an app-enforced session timezone. |
| US/USD, UK/GBP and EUR/national releases; medium/high | Requested scope is visible in the app, but the public builder supplies no documented region/currency/importance configuration. Initial live embed showed wider currencies and importance levels. Exact defaults are **not satisfied**. |
| Session IANA timezone and DST | No documented builder timezone parameter found. Local browser QA visibly showed a widget clock two hours behind the Bucharest app clock. App does not label widget times as session times. **Not satisfied.** |
| Provider figures/classifications/geography | Display remains wholly provider-controlled. No app-assigned importance, geography relabelling, numeric inference, or guessed release status. |
| Custom 60-minute warning | No supported web API, SDK callback or authorized structured feed was established in reviewed documentation. **Unavailable.** |
| Responsive display | Autosize rendered at 1440 and 390 viewport widths; app had no page-level horizontal overflow. Narrow widget layout hides/rearranges some provider columns. |
| Loading/failure verification | No documented readiness/coverage/error callback. iframe load is not considered proof of provider success. A permanent coverage caveat and original-site fallback link remain visible. No inferred successful-empty state. |
| History/retention | Widget embedding permission is not treated as permission to store/replay events. Live widget is withheld in saved/as-of and non-current views. |

The current backend returns `calendar.source=TRADAYS`, `mode=WIDGET_ONLY`, `coverage=UNAVAILABLE` (or HISTORICAL), no checked/freshness timestamps and no events. There is deliberately no invented REST URL, Tradays API key variable, hidden enable flag or MQL5 bridge.

The independently testable frontend warning contract accepts only explicitly authorized structured coverage. It checks exact HIGH importance, USD/GBP/EUR scope, a reliable instant, non-cancelled/non-released status and `now < scheduledAt <= now + 60 minutes`. It retains actual geography, picks the latest version of stable provider identities, deduplicates, orders multiple alerts and removes alerts at their scheduled instant. It distinguishes complete empty, partial, stale, unavailable and historical coverage. Invalid, absent or numeric importance never becomes HIGH. These are **normalized-contract fixture tests**, not a verified Tradays importance mapping or live adapter.

To finish the requirement, the owner must obtain a documented supported Tradays feed/callback and explicit permission for customer-facing display, event processing, shared caching and any historical retention. That agreement must establish raw importance mapping, exact timezone semantics, stable event IDs, update/cancellation behavior and coverage freshness. Then implement and validate the adapter against real authorized data. Supported alternatives for a user decision are: retain this openly limited official widget, or pursue separately authorized Tradays access if offered. Choosing another provider for custom alerts would be a scope change and was not done. An MQL5 calendar interface alone does not establish standalone-web redistribution rights.

## Official news sources

| Source | Role and refresh | Live check in this change |
| --- | --- | --- |
| Federal Reserve monetary-policy RSS | US official policy headlines/links, 30 min | 15 stories parsed |
| ECB press RSS | Euro-area policy headlines/links, 30 min | 15 stories parsed |
| Eurostat economy/finance Atom | European/euro-area announcements, 30 min | 11 stories; 2 separately evidenced HICP releases |
| ONS published-release RSS | Relevant UK economy, prices, GDP, labour, trade, retail, investment and productivity releases, 1 h | 4 relevant stories parsed |
| Destatis official RSS | Relevant German economic releases, original German headlines, 1 h | 8 relevant stories parsed |

Counts are observations from a bounded rolling response, not coverage or latency guarantees. ONS reads the documented release-calendar RSS link with published-only filtering, first ten items, no pagination. Explicit economic-title rules remove unrelated releases; there is no guess about publication from a scheduled time. Destatis uses its official linked RSS feed, with auditable German economic-title rules. These are NEWS adapters, not Tradays/calendar substitutes.

[ONS terms](https://www.ons.gov.uk/help/terms-conditions) describe OGL content, feeds and caching; [OGL v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) covers permitted reuse with attribution. The app links attributed original ONS releases and publishes no third-party photos. [Destatis RSS directory](https://www.destatis.de/DE/Service/RSS/RSS_Einfuehrung/_inhalt.html) links the [official feed](https://www.destatis.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/Aktuell.xml); [Destatis copyright](https://www.destatis.de/DE/Service/Impressum/_inhalt.html) permits reproduction/distribution with attribution, subject to exceptions. Headlines retain their source language.

Bank of England news/speeches were evaluated and remain disabled: [general website terms](https://www.bankofengland.co.uk/legal) limit general Resources to personal/internal non-commercial use without further permission. Its separate statistical Database OGL is not extended to website news/speeches. UK profiles explicitly show an authorization-required policy-coverage gap. GDELT was not added.

Existing official schedules and observations continue independently: BEA and Eurostat schedules parsed 119 and 309 events respectively; BLS calendar returned HTTP 403, explicitly reported as blocked. BLS unemployment, BLS CPI and Eurostat EU27 unemployment each parsed one observation. EU27 remains EU27, not euro-area data. Observations are latest-vintage retrospective data, never joined to scheduled rows or shown as historical release values. Missing/zero figures remain distinct; forecasts are not called analyst consensus. A passed schedule does not prove publication.

## Instrument profiles and relevance

`InstrumentTopics` reuses `InstrumentAliasService` for DAX aliases, including its broker suffix rules and FDAX/FDXM/FDXS families. The existing `SymbolSearchService` stock/FX registry was inspected; chart/trade registry behavior was not changed.

| Selection | News profile |
| --- | --- |
| NAS, NAS100, US100, Nasdaq-100, NQ/MNQ and continuous/prefixed aliases, OANDA:NAS100USD | US technology/semiconductors and Nasdaq context; US macro |
| GER40, DE40, DAX and existing DAX registry aliases, OANDA:DE30EUR | German equity context, Destatis, ECB/Eurostat; US macro as cross-market context |
| UK100, FTSE/FTSE100, OANDA:UK100GBP | UK equity context and ONS; US macro as cross-market context; BoE gap disclosed |
| EURUSD / GBPUSD, including broker prefixes | EUR+US / UK+US official context |
| USDJPY / AUDUSD from the existing registry | Partial US context; missing non-US coverage disclosed |
| Qualified NASDAQ/NYSE/AMEX, LSE, XETR/FWB, EURONEXT/EPA/AMS stocks | Exact configured provider company identity first; matching available sector context; official regional fallback |
| Bare stock ticker or unknown instrument | Unsupported/identity-required; no ambiguous ticker keyword match |

Recognizing a qualified identity is **not** proof of provider listing coverage. `NEWS_MARKETAUX_COMPANY_MAPPINGS` defaults to an empty JSON array. Each entry needs an operator-verified `identity`, provider `symbol`, non-null `exchange`, ISO `country` and `sector` (empty if unknown). Duplicate identities/provider entities, inconsistent country/region, unsafe strings and unknown identity syntax are rejected. The adapter requires exact equity symbol + exchange + country metadata. Null exchange metadata does not get guessed; unresolved articles are omitted from company results. US, UK and European mapping paths are fixture-tested; none is claimed live without authenticated provider verification. Mapping metadata should be maintained as listings change.

Auditable relevance tiers are exact company / explicit index context, then relevant equity-sector context, then regional macro, then justified US cross-market macro for German/UK indices. Newest stories sort first within each tier. Company direct matches override the category of the shared topic story. Sector matches use exact provider country/industry tags and configured company sector (currently the shared US Technology feed). UK/European stocks without such sector coverage fall back to labelled regional macro. No LLM or sentiment-to-trade recommendation is involved.

## Marketaux permission, requests and company demand

[Documentation](https://www.marketaux.com/documentation) verifies `/v1/news/all`, UTC publication timestamps, symbol/country/type/industry filters, entity metadata and grouped similar results. [Pricing](https://www.marketaux.com/pricing), rechecked 2026-10-01, advertises **100 requests/day and 3 articles/request** on Free. That is not comprehensive or instantaneous coverage. [Public terms](https://www.marketaux.com/tos) do not establish this app's customer-display/cache rights; a key alone never enables it.

The existing adapter remains gated by both `NEWS_MARKETAUX_AUTHORIZED=true` and a server-only token. The authorization must cover publisher-attributed headlines/links, processing, shared cache and immutable retention. If retention is restricted, the existing immutable snapshot model needs a separately designed compatible retention policy before enabling the provider. No live Marketaux requests or entity verification were performed. The account's actual limits/entitlements and any additional publisher permissions remain unverified.

Three shared feeds use US Technology, German equities and UK equities filters. Each requests at most three articles; no automatic pagination. The company query uses a verified provider symbol and country; returned entities are then matched against exchange-qualified metadata. The browser receives neither API tokens nor raw provider errors.

`POST /api/market-context/company-demand?instrument=...` is authenticated. It records only a public company identity and demand time, not a user/account watchlist. It returns QUEUED, CAPACITY, MAPPING_REQUIRED or DISABLED. Instrument selection reads cached GET data immediately and only queues bounded company demand; it never issues an upstream call in the HTTP request. The existing refresh route cannot accelerate Marketaux feeds.

V73 adds `news_company_demand`. Transaction-level PostgreSQL advisory locking caps active identities at eight across instances/users; repeated company requests renew one record. Inactive demand expires after 24 hours. Each company feed refreshes no more often than six hours through existing durable leases; successful payloads remain shared and historical snapshots immutable.

| Daily budget | Calculation |
| --- | --- |
| Marketaux topics | 3 × 12 two-hour refreshes = 36 normal attempts |
| Company attempts | 8 × 4 six-hour refreshes = 32 maximum scheduled attempts; **all company retries also consume this same 32 cap** |
| Application total ceiling | 80, hard-clamped; 12 slots above the normal 68 for topic retries/operational headroom |
| Outside application ceiling | At least 20 below the advertised free-plan cap |
| ECB / Fed | 48 each |
| ONS / Destatis | 24 each, plus bounded failures/retries under their configured 80/provider ceilings |
| Existing Eurostat | 48 news + 4 schedules + 4 observations = 56 |
| Existing BEA / BLS schedule | 4 each normally |
| Existing BLS numerical | 2 × 4 = 8, shared 20 cap with admin requests, below the documented 25/day public ceiling |

Company budget and provider-total reservations commit atomically; rejected global reservations do not consume a company allowance. Existing coalescing, lease fencing, failure backoff, Retry-After handling, authentication cooldown, 4/6-second timeouts, 2 MB body cap, disabled redirects, safe HTTPS links and successful-cache retention remain. One transient retry consumes another reserved attempt. Quota, failed, stale, pending, partial, disabled and unsupported states are distinct from successfully checked empty responses.

## History, configuration and local validation

V72 is unchanged. Only snapshots fetched by the cutoff can contribute to a historical/as-of read. Historical dates end at the next local midnight, including DST; last-24-hours as-of reads now anchor at the cutoff rather than wall-clock now. Official observation APIs are excluded from saved/history views. Tradays has no persisted events or replay. Company mapping configuration is current metadata, not a promised historical security master.

See `backend/news.env.example` and the existing `news:` application configuration. Docker Compose passes the additional mapping JSON server-side. User-owned `.env.example`, `frontend/.env.local`, `backend/src/main/resources/pine/__pycache__/` and `tests/` were preserved. Existing migrations were not rewritten. The Spring backend must remain running for scheduled work; scale-to-zero hosting needs a separate supported scheduler arrangement.

Local checks and remaining evidence are recorded below. Test credentials and mapping identities are fixtures only. Browser QA imported the **actual MarketIntelligenceGrid and NewsEventsPanel** with an explicitly labelled fixture news API; Tradays loaded from its real public widget. Today route tests separately exercise account/preparation/Ready boundaries. This is not a production or authenticated Marketaux/Tradays-feed test.

Re-run focused backend checks on a disposable local database:

```sh
createdb tradevault_news_qa_context_check
NEWS_TEST_DB=jdbc:postgresql://localhost/tradevault_news_qa_context_check \
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
mvn -f backend/pom.xml -Dtest=NewsContextTest,MarketContextProfilesTest,NewsFeedStoreTest,NewsContextControllerSecurityTest,MarketWorkspaceServiceTest,SessionReviewServiceTest,SessionWorkspaceServiceTest,SessionBriefingSelectionTest,OfficialEventPipelineTest test
```

The store test explicitly opts in only for `localhost/tradevault_news_qa_*`, applies the full Flyway chain and verifies concurrent demand/quota/lease behavior. Without the opt-in it skips. Live smoke is separate: `NEWS_LIVE_SMOKE=true ... -Dtest=NewsProviderLiveTest test`; it consumes real public-source requests, so do not poll it repeatedly.

Frontend checks: run the news, MarketIntelligenceGrid, Today preparation and workspace lifecycle Vitest suites; `npx tsc --noEmit`; focused ESLint for modified files; `npm run build`. Screenshot evidence is under `output/market-context-tradays-2026-10-01/`.

Full calendar acceptance still requires verified exact regional/importance defaults, session timezone behavior and a supported authorized event interface driving live custom warnings. Normal provider-account verification and production verification remain separate. Passing fixtures and a rendered widget cannot close those requirements.

### Validation results for this change (2026-10-01, Atlantic/Canary)

- **114 backend tests passed, zero failed/skipped**, across nine focused suites. This includes the actual Spring Security filter chain in a WebMvc slice (anonymous GET/refresh/company-demand rejected with 401), authenticated fixture requests, and five real PostgreSQL store tests. The fresh disposable database successfully applied all 73 migrations through V73. Concurrent tests admitted exactly eight active company identities and 32 company attempts; existing lease, quota, immutable snapshot and stale-retention checks passed.
- **43 frontend tests passed across six suites.** Coverage includes warning boundaries, unknown/numeric importance, duplicate versions, cancellation/rescheduling, multiple alerts, local-midnight/DST, timer/focus/visibility resume, saved/as-of suppression, instrument/timezone races, stable iframe identity across instrument switches, separate company queueing, and Today/Ready preservation.
- **11 live public-adapter checks:** ten passed; BLS schedule was explicitly skipped after HTTP 403. ONS and Destatis live parsing passed. These checks did not authenticate to Marketaux and did not read structured Tradays data.
- **Browser QA:** actual integrated components at 1440×1000 and 390×900; fixture news responses clearly identified; real public Tradays widget. EN/RO, light/dark, keyboard tab selection, source fallback, stable calendar selection, no page horizontal overflow, and saved-view suppression checked. The session crossed Bucharest midnight: the old-day embed disappeared without a reload; after selecting the new current session date, the provider still displayed its own prior day. This proves the reason for the timezone/day limitation, not compliance with it.
- **TypeScript, focused ESLint, final production build, `git diff --check`, and Compose configuration passed.** Existing Vite chunk-size, React Router future-flag, Flyway/PostgreSQL compatibility, and Compose obsolete-version warnings remain. Temporary QA entry files and generated SEO-only churn were removed; only this run's disposable DB/server were cleaned up.
- Evidence: [machine-readable validation](../output/market-context-tradays-2026-10-01/validation.json), [desktop calendar](../output/market-context-tradays-2026-10-01/desktop-calendar-en-dark.jpg), [mobile calendar](../output/market-context-tradays-2026-10-01/mobile-calendar-ro-light.jpg), [mobile news](../output/market-context-tradays-2026-10-01/mobile-news-ro-light.jpg), [saved view](../output/market-context-tradays-2026-10-01/mobile-history-ro.jpg).

These checks do not establish a normal full-backend startup or production deployment. The prior implementation notes recorded an unrelated default Hibernate `asset.scope` schema-validation problem; full startup was not revalidated or that unrelated schema changed in this task. No production environment/database was used.
