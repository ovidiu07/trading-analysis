# Official event staging and reviewed results

Reviewed 2026-09-25. This feature extends the typed V67 session-briefing workflow. It does not publish automatically, create provider accounts, require API credentials, scrape calendar HTML, or change live configuration.

## Implementation map

| Area | Implemented behavior | Boundary |
| --- | --- | --- |
| Official schedules | Admin-triggered BLS and Eurostat iCalendar imports | Suggestions only; no scheduler or public staging endpoint |
| Official results | Exact BLS unemployment and CPI-U index observations; Eurostat EU27 unemployment observation | Admin selects the measure/month and verifies official publication time and URL before requesting data |
| Provenance | Agency, canonical/native event IDs, identity method, region/name, scheduled instant or explicit date, timezone, URL, source and result retrieval times, status, value/unit, publication time/evidence, series and reference period | Unknown instants/values stay absent; publication time is reviewed evidence, not inferred from API availability |
| Revisions | Append-only source revisions; explicit cancellations; reviewed reschedules; older sequenced updates ignored | Feed disappearance never means cancellation; no fuzzy event matching |
| Admin | Import inbox, source status, history, result review, explicit identity linking, add selected revision to draft | Existing save → preview → review → publish flow remains the only publication path |
| Today | Shared event display with source links, units, source timezone, retrieval/publication times and unavailable forecasts | Current-day Prepare refreshes latest published events; historical Prepare uses its capture. Imports never replace published or Ready/history content |
| Other sources | BEA, ECB, Destatis and Federal Reserve assessed below | Not wired into imports until exact schedule/result mappings are reviewed and tested |

## Source contracts and reuse review

### BLS

- Official [calendar subscription documentation](https://www.bls.gov/help/hlpiCAL.htm) identifies `https://www.bls.gov/schedule/news_release/bls.ics`.
- [API FAQ](https://www.bls.gov/developers/api_FAQs.htm), [API features](https://www.bls.gov/bls/api_features.htm) and [API signatures](https://www.bls.gov/developers/api_signature_v2.htm) document public time-series access and unregistered limits. This implementation uses the unregistered v1 series endpoint; it does not obtain a key. The documented unregistered budget is 25 requests/day, 25 series/request, ten years/query. v1 does not provide series metadata; supported identities/units are curated rather than inferred from values.
- [API terms](https://www.bls.gov/developers/termsOfService.htm) and [copyright information](https://www.bls.gov/bls/linksite.htm) require source attribution and the API disclaimer. The display includes agency, retrieval time and the required disclaimer; no agency logo is used.
- Curated results: `LNS14000000`, US unemployment rate, seasonally adjusted, percent; `CUUR0000SA0`, US CPI-U all items, not seasonally adjusted, index 1982–84=100. The CPI index is **not** a month-on-month/year-on-year inflation headline. See the official [CPI data directory](https://www.bls.gov/cpi/data.htm). No headline change is calculated.
- Values are selected by exact series and `M01`–`M12` reference period, never the newest array item or annual average. Official footnotes are retained. Result retrieval time is retained separately when a later calendar update carries forward an unchanged result. The API can lag a news release and can contain revised observations; a result is labelled latest API vintage, not historical first release.
- Live evidence: the public unemployment API responded successfully without credentials. The calendar returned HTTP 403 from this environment. The adapter reports that failure and keeps existing suggestions; no HTML or unofficial fallback exists. Successful live BLS calendar ingestion remains unverified.

### Eurostat

- Official [release calendar](https://ec.europa.eu/eurostat/web/main/news/release-calendar) and [subscription interface](https://ec.europa.eu/eurostat/subscribe/ics.format) expose the calendar endpoint `https://ec.europa.eu/eurostat/o/calendars/eventsIcal?theme=0&category=2` (all themes, Euro indicators).
- Official [Statistics API documentation](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api) describes JSON-stat datasets and dimensional filters. Requests require no account or key.
- The [copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice) permits reuse subject to attribution and identified exceptions. The implemented observation covers EU27; this is not a general authorization for third-party or excluded non-EU data or logos. Source and result URLs are retained with every reviewed observation.
- Curated result: `une_rt_m`, `freq=M`, `unit=PC_ACT`, `s_adj=SA`, `age=TOTAL`, `sex=T`, `geo=EU27_2020`, explicit `time=YYYY-MM`. Every dimension and dataset identity must match the response. Missing sparse cells remain unavailable; observation flags are preserved. Dataset `updated` is not used as the observation's publication time.
- Live evidence: the official subscription feed and the filtered public statistics API responded successfully. The current subscription emits literal escaped CRLF separators and date-only events; the parser handles that format without inventing an hour. Source timezone is Europe/Luxembourg.
- The observed feed generates different native UIDs across identical requests. Canonical identity therefore uses an exact name/date/instant/timezone signature while retaining the native UID on meaningful revisions. Unchanged fetches do not generate duplicates. A moved/renamed event with a different signature is a separate candidate until an admin explicitly links its revision to the prior event. Both original records and the reviewed link remain immutable; subsequent fetches use that link. No disappearance or similar name is treated as proof of cancellation/reschedule.

### Additional official sources evaluated, not enabled

| Agency | Stable official interface and reuse basis | Decision |
| --- | --- | --- |
| BEA | [Calendar subscription](https://www.bea.gov/news/schedule/icalendar) provides ICS and a machine-readable JSON schedule. [Developer API](https://www.bea.gov/resources/for-developers) requires a user key. [Reuse FAQ](https://www.bea.gov/help/faq/147) explains public-domain use and attribution. | Good schedule candidate; no result API integration or key creation in this task. |
| ECB | [Data API overview](https://data.ecb.europa.eu/help/api/overview) documents SDMX access. [Statistics usage policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) covers reuse of public ESCB statistics with attribution and exceptions. | Candidate for exact statistical series. A verified release-to-series/publication-time mapping is still required; not a general policy-event calendar adapter. Direct documentation access also returned a transient 503 in this environment. |
| Destatis | [GENESIS API documentation](https://www.destatis.de/DE/Service/OpenData/genesis-api-webservice-oberflaeche.html) describes free access without registration and Data Licence Germany attribution 2.0; [official interface introduction](https://genesis.destatis.de/datenbank/online/docs/GENESIS-Webservices_Introduction.pdf). | Candidate only. Current REST contract and exact dataset/release mapping need a dedicated adapter and tests. |
| Federal Reserve | [Official data directory](https://www.federalreserve.gov/data.htm) exposes Data Download Program releases; [disclaimer](https://www.federalreserve.gov/disclaimer.htm) describes public-domain material and third-party exceptions. | No HTML extraction. No adapter until stable schedule/result contracts and precise publication semantics are verified. |

No source is approved for automatic publication. Consensus, forecast, impact and previous values are never generated by the importers. Existing manually reviewed forecast/previous fields require a source URL at publication; they are unavailable without one. A URL is provenance, not a blanket grant of third-party redistribution rights: editors must still review the source's applicable authorization. Imported official entries cannot be edited in place while retaining verified provenance; preview and publication compare them to the exact immutable suggestion revision.

## Publication and history rules

1. Admin refresh stages normalized calendar revisions. It does not change any briefing.
2. To fetch a result, the admin explicitly chooses the supported measure/reference month and records an official publication URL and UTC/offset instant after checking the release. A required checkbox confirms that review. The API itself does not establish publication permission or time.
3. Future publication times, publication before the scheduled date/instant, cancelled events, wrong agencies, non-official URLs and future reference periods are rejected **before** the data request. API/parse failures do not produce observations.
4. The retrieved result remains a suggestion. The admin selects its latest revision and adds it to the current language's draft, previews it, and uses the existing publication controls. There is no implicit cross-language translation.
5. Publication requires the official retrieval time and actual's publication time to be at or before the briefing's reference time. This prevents fetching a revised dataset now and backdating it into an earlier briefing. Source evidence and values must match the stored suggestion exactly.
6. Published revisions, source revisions, identity links and stored preparation compositions remain immutable. Historical Prepare and Ready/history read the preparation capture. Current-day Prepare separately displays the latest administrator-published events, with a visible update boundary and last successful check; this does not recapture or acknowledge a newer briefing or change captured editorial levels. A read-time defensive copy withholds premature/unknown actuals and unsourced forecast/previous values in older payloads without mutating stored history.

Calendar-only events remain scheduled until a result is reviewed; elapsed time does not prove release. A date-only source remains date-only even if the admin verifies a publication instant later. Treasury continues to display official daily observations, never live rates. TradingView and native provider pricing are outside this pipeline.

## Bounds, persistence and failure behavior

V70 adds a fixed source registry, import-run ledger, append-only event revisions and immutable reviewed identity aliases. It reuses V67's immutability trigger function. No existing migration was rewritten.

Imports are admin-only at controller and service boundaries. Fixed HTTPS endpoints, exact host/path allowlists, no redirects, four-second connection/six-second request timeout, two-megabyte payload bounds, a maximum 5,000 calendar events and no recurrence expansion bound remote work. Unknown/ambiguous formats fail closed. The parser uses IANA timezone rules and rejects nonexistent or ambiguous local instants rather than choosing an offset.

Database source locks serialize budget reservation and revision writes across application instances. The same calendar or series/month request has a one-hour cooldown; result requests have a 20-attempt rolling 24-hour per-source budget, including failures. This leaves headroom under BLS's unregistered 25-query limit, but other software sharing the egress IP is outside this ledger. There are no automatic retries. Failed runs are recorded and retain earlier suggestions. Missing entries never delete or cancel prior observations. Result writes use an expected revision to reject concurrent stale edits. An interrupted run remains STARTED and still counts against budgets.

## Local validation and limits

Focused tests cover parsing/folding, UTC and US/European DST boundaries, date-only sources, invalid/ambiguous times, changing Eurostat UIDs, deduplication, out-of-order revisions, reschedules/cancellations, exact observation dimensions/periods, missing values, publication embargoes, provenance tampering, upstream failures, immutable snapshots and switching drafts during an import. PostgreSQL tests exercise actual insert/revision/alias/cooldown behavior and reject mutation of source revisions.

The opt-in store suite accepts only an isolated `jdbc:postgresql://localhost[:port]/tradevault_events_qa_*` database name (see its exact regex). Local verification used `tradevault_events_qa_20260925_1405`, minimal prerequisite fixture tables plus the actual V67 trigger function and V70 migration. This proves V70 and store behavior against those prerequisites; it is not a full application startup or production migration test. No production database, public briefing or provider account was changed. Authenticated end-to-end browser behavior and successful BLS calendar connectivity remain unverified.

Validation on 2026-09-25: 82 backend tests across event, briefing and native-watchlist regression suites passed (including four opt-in PostgreSQL tests, no skips); 50 unique frontend tests passed across event/admin, briefing capture, Today and watchlist suites. TypeScript, targeted ESLint and `git diff --check` passed. The final Vite production bundle was generated outside the workspace at `/tmp/tradejaudit-events-build-20260925-final`; existing bundle-size and tool deprecation warnings remain. Today tests emitted network-error logs for ancillary unmocked requests while their assertions passed; these are not evidence of authenticated integration.

Subsequent Today integration checks and evidence boundaries are recorded in [Today market integration](today-market-integration.md).
