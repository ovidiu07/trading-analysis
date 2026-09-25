# Today Prepare market integration

Local implementation verified 2026-09-25 on `redesign-upgraded-improved`. This extends the existing authenticated Today route, native workspace endpoint and reviewed session briefings. No provider authorization gate was enabled; no production configuration, data or publication was changed.

## Behavior

- Native prices require the exact canonical/provider identity, account-authorized server response, USER_CONNECTED provenance, MID basis and a fresh observation. Stale, disconnected, closed/closeout and denied values are hidden with an explicit reason. Source, provider symbol, instrument type, basis, observation/retrieval times and freshness remain visible. The existing provider-settings link remains available. DXY and ES remain unavailable with no substitute.
- Completed-candle levels and ranges are separate from current quotes, and must match the selected canonical instrument and exact provider symbol. The shared OANDA parser now requires explicit boolean `complete: true` and matching response instrument/granularity. Current-versus-previous-close change requires a fresh compatible midpoint. Missing bar counts are unavailable, not zero.
- Current-day Prepare refreshes latest administrator-published events every 30 seconds while visible. A label explains this update boundary and shows the last successful check. The query is shared with BriefingPanel; it never captures or acknowledges a newer revision. Editorial levels, historical Prepare, Ready and history retain the captured composition. Failed refreshes retain reviewed content with a warning and the previous check time.
- Event details show local display time, original source timezone, scheduled/released/cancelled status, official source links, publication time, calendar/result retrieval times and explicit unavailable forecast/consensus. Existing publication-time and provenance defenses remain in place. Staged imports are never shown to customers until reviewed and published through the existing admin flow.
- The events action opens the Market Context disclosure and moves keyboard focus there. EN/RO labels, wrapped provenance and responsive cards are retained. Treasury yields are labelled official daily observations regardless of an erroneous upstream live flag.
- TradingView remains a visibly separate display-only widget. Ready accepts native/official provenance metadata only, omits numeric prices/yields, and rejects display-only provenance server-side. Risk, trade creation and Review boundaries are unchanged. No active Today caller imports fixed demo market fixtures.

## Validation

62 unique frontend tests passed across 12 suites, covering the real Today/Prepare component composition with a mocked authenticated session, instrument selection, stale values, metadata-only Ready, published-versus-captured events, keyboard context opening, EN/RO local timestamps, native heartbeat/isolation, and event/admin model behavior. The new authenticated-component tests mock their API traffic; older remove-plan tests still emit ancillary unmocked network-error logs despite passing assertions.

99 backend tests passed with Java 21 across native workspace, analysis, OANDA batches/completed candles, Ready sanitization, event parsing/store, briefing validation/selection, provider service and transaction-boundary suites. The four event store tests use the isolated localhost `tradevault_events_qa_20260925_1405` database; this is not production or a fresh full-application migration test.

TypeScript, targeted ESLint (no errors) and whitespace checks passed. ESLint retains the pre-existing TodayPage `initialForWorkspace` dependency warning. Vite built successfully into `/tmp/tradejaudit-today-integration-build-20260925`; existing bundle-size and CJS deprecation warnings remain.

A temporary local component preview with synthetic fixtures and network access disabled was checked at 390px and 1440px widths, including EN/RO, light/dark and keyboard activation. No page-level horizontal overflow was measured. It was removed from the workspace after verification. This is component-browser evidence, not a real authenticated provider/hosted test.

## Remaining external boundaries

Customer display and candle-derived-data authorization remain disabled pending documented authorization. This integration does not treat personal API access as redistribution permission. Real authenticated hosted/provider behavior remains unverified. The previously observed BLS calendar HTTP 403 remains an external ingestion limitation; no alternate scraped or unofficial source was added. No deployment, commit, push or PR was performed.

See [source boundaries](market-data-source-boundaries.md) and [official event pipeline](official-event-pipeline.md) for source contracts, reuse review and operational limits.
