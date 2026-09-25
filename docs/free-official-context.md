# Private preparation levels and free official context

Implemented locally on 2026-09-25. This extends the existing Today Prepare, private session-review revisions and reviewed briefing pipeline. No provider account, API key, production change, publication or deployment is part of this work.

## Product behavior

- Prepare → Key levels → Add private level accepts support, resistance, invalidation or reference values, explicit units and a note. Levels belong to the authenticated user's account/date/session and exact qualified chart identity. Cash indices, CFDs and futures identities do not share entries.
- Existing preparation autosave persists the list with optimistic revision checks and ownership validation. The server supplies author, MANUAL provenance and update time. Up to 40 levels are allowed. An omitted field from an older client preserves existing entries; an explicit empty list clears them in a new revision.
- Ready captures these private values once. Later edits cannot rewrite that snapshot. Both Ready and history show read-only levels. Manual levels are neither provider prices nor automatic risk/order inputs.
- TradingView remains a separate display-only iframe. No widget data is read, extracted, stored or used for calculations.
- Native quotes and completed-candle analysis remain optional and independently authorization-gated. Both OANDA authorization defaults remain off. Account access does not establish customer-display or derived-data permission. ES, DXY and uncovered instruments retain explicit unavailable states, without substitutions.
- EN and RO labels cover the new controls and source boundaries.

## Sources and reuse conditions

| Source | Exact use | Connection / publication boundary |
| --- | --- | --- |
| BLS | Existing official release calendar and curated unemployment/CPI index result requests | No key; admin-reviewed suggestions; source attribution and API disclaimer retained |
| Eurostat | Existing official calendar and exact EU27 monthly unemployment observation | No key; admin-reviewed suggestions; attribution and dataset exceptions apply |
| US Treasury | Existing official US 2Y/10Y daily yield observations | No key; daily observations only, never live prices |
| ECB | Daily USD and GBP reference rates per 1 EUR, unchanged from official XML | No key; informational daily card with attribution, observation date, retrieval time and CLOSE/STALE/UNAVAILABLE state; excluded from quotes, candles, risk and Ready market snapshots |
| EIA | Published US commercial crude oil stock level excluding SPR, series WCESTUS1, thousand barrels, exact reported reference week | Public WPSR JSON needs no key; admin review required before publication; no schedule invention, price, weekly delta, consensus or forecast |

Official sources reviewed:

- [BLS API terms](https://www.bls.gov/developers/termsOfService.htm), [calendar documentation](https://www.bls.gov/help/hlpiCAL.htm).
- [Eurostat API documentation](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api), [copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice).
- [Treasury official XML feed documentation](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed).
- [ECB reference-rate page and XML download](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), [ESCB statistics reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html). Public statistics permit commercial/noncommercial reuse with source attribution and unchanged statistics/metadata; third-party data exceptions remain. No cross rate is derived. Daily reference rates are not transaction prices.
- [EIA Weekly Petroleum Status Report](https://www.eia.gov/petroleum/supply/weekly/), [official public JSON](https://ir.eia.gov/wpsr/psw00.json), [release schedule/timezone](https://www.eia.gov/petroleum/supply/weekly/schedule.php), [reuse policy](https://www.eia.gov/about/copyrights_reuse.php), [automated-access policy](https://www.eia.gov/about/privacy_security_policy.php). EIA permits reuse of its public-domain data with acknowledgment including publication date; third-party materials and logos are excluded. The adapter fetches the published JSON directly; it does not scrape HTML or use the API that requires registration.

## Operational bounds

ECB's authenticated, no-store endpoint shares only public reference observations. Its bounded two-row process cache refreshes hourly on demand, backs off 15 minutes after failures, retains successful observations with STALE status, and reports the actual last retrieval/attempt time. No user token is requested. Observations older than four calendar days are stale. XML external entities and DTDs are rejected; fixed HTTPS download and a two-megabyte limit bound input.

EIA uses the existing database-backed import budget and immutable revision store. Source metadata supplies official publication time with DST handling. Future releases are rejected. Identical observations deduplicate regardless of retrieval time; revised values retain the original revision. A result fetched now cannot be backdated into an earlier briefing. The source exposes the latest vintage; this adapter does not claim to reconstruct first-release history. Unknown/missing values remain unavailable. The signed official download redirect is tightly restricted and never saved or logged.

The new V71 migration only adds EIA to the fixed official source registry; manual levels reuse the existing preparation JSON.

## Validation and remaining boundaries

- 98 backend tests passed, including five PostgreSQL store tests and two opt-in, successful live downloads/parses of ECB and EIA. No skipped tests in this selected run.
- 41 frontend tests passed across private levels, actual Today integration, official-reference display, admin review, event schema and Market Context. Coverage includes exact instrument isolation, server-stamped metadata, ownership, omitted versus cleared values, Ready preservation, embargoes, revisions, unavailable states and provenance.
- TypeScript and targeted ESLint passed. The production frontend bundle built outside the repository; existing chunk-size warnings remain.
- Remote browser verification exercised the real changed components in a temporary local harness: add/apply by keyboard, exact CFD versus cash-index switching, Romanian edit/comma decimal handling, removal, EN/RO text, 390px mobile and 1440px desktop without horizontal overflow. External calls were disabled in the harness. This proves component interaction/layout, not an authenticated full-stack or deployed session.
- Migration/store verification used the isolated local database `tradevault_events_qa_20260925_freecontext`, minimal prerequisite tables, the actual V67 immutability function and V70/V71 migrations. This is not a full production migration rehearsal. Previous full-startup notes about the unrelated asset enum validation remain applicable.
- Successful live BLS calendar access and current Treasury connectivity were not established by this change. Their prior failure states remain explicit; no fallback scrape exists. No reviewed events were published. Customer-visible event population still requires the administrator's normal review/publication workflow.
