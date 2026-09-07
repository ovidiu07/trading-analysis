# Administrator-published session briefings — first release

## Daily operation

Open **Admin → Session briefings** (`/admin/session-briefings`). Choose an explicit editorial date in **Europe/Bucharest**. Create an empty ASIA, LONDON, or DAY_RECAP draft. All three can be prepared in advance. A new slot never copies yesterday's factual content.

Either fill the structured editor or open **Paste generated briefing**, paste JSON, validate it, review the rendered import, and choose **Use reviewed import in draft**. Invalid JSON stays in the text area. Draft changes autosave after 900 ms, with Saving/Saved/Failed states and an account-specific local recovery copy. On a conflict, download the retained draft or reload the server version, restore retained text, and merge deliberately. A conflict never overwrites the server silently.

**Preview publication** performs the server's complete validation and renders the same editorial component used in Today. Check the facts/sources/reference/translation review confirmation, then **Publish reviewed revision**. Updates create immutable numbered publications; retrying a publication is idempotent. History includes publication payloads, editor identities and action timestamps. **Withdraw from discovery** removes the canonical publication from new selections but preserves immutable history and saved preparation references. To republish after withdrawal, save and review the new draft revision.

English and Romanian are independently edited in the existing CMS translation pattern. Missing translations are explicitly labelled in Today. Publishing requires reviewing the translations present; no translation service is invoked.

Copyable external-task specification and empty downloadable JSON templates:

- [Generation prompt](session-briefing-templates/GENERATION-PROMPT.txt)
- [ASIA](session-briefing-templates/ASIA.json)
- [LONDON](session-briefing-templates/LONDON.json)
- [DAY_RECAP](session-briefing-templates/DAY_RECAP.json)

The files contain sentinel timestamps and empty content intentionally. They are structures, not market claims or publication-ready briefings. The Admin download buttons create empty structures using the chosen date. No external scheduled task was configured or modified.

## Trader selection and chronology

New preparations default to editorial content; Today no longer calls provider-backed generation. Legacy private briefing records remain readable through their existing owner-scoped endpoint.

The default editorial date is Europe/Bucharest's current date for a current account workspace; explicitly opened historical account dates start with that date. Editorial date can be selected independently inside preparation. Account/broker timezone still determines trade-review membership. The exchange/provider defines an instrument's trading day; neither editorial timezone is a replacement for that convention.

Europe/Berlin clock thresholds:

| Clock | Preferred slot |
|---|---|
| Before 16:15 | ASIA |
| 16:15 inclusive to before 22:30 | LONDON |
| 22:30 inclusive | DAY_RECAP |

These are product thresholds, not exchange hours. DST follows IANA Europe/Berlin, independent of US seasonal clock changes. The date is explicitly assigned by the editor; publication time never determines it.

A missing preferred slot is named. Selection falls back to the latest eligible earlier slot/date without relabelling it. Before today's Asia publication, the preceding available day's recap is preferred by descending date and session order; when that day has no recap, its latest available earlier publication is used. No Friday or holiday calendar is assumed. The previous available recap is also accessible as a separate expandable context block.

Preparing users retain their captured selection across refreshes and clock changes. A 30-second discovery poll can offer an explicit switch when the preferred publication/session changes. Manually chosen date/session is retained. Switching context clears the preparation/context confirmations; it never changes trade session membership or rewrites an existing Ready snapshot.

The selected publication leads with its summary. The ordered same-day timeline is Asia → London → recap, with earlier sections expandable. Repeated stable IDs are identified; changed facts require a new ID and UPDATE/CORRECTION/CONTINUATION relationship. Publication rejects silent stable-ID rewrites, duplicate IDs, unresolved relationships and cycles. No fuzzy textual merging or generated connecting prose is used.

**Composition cutoff:** each selected publication bounds the view by both its information reference and its real publication instant. For each eligible same-day slot, capture uses the latest revision published no later than that selected publication and with information reference no later than its reference. Earlier-session views therefore exclude later sessions. Late publications with earlier references cannot enter an already earlier publication-time view. Previous-day recap context uses the same cutoff and stays separate. A newly published earlier-slot update may require selecting that slot explicitly; it does not retroactively rewrite a later slot's already published account of the day.

The complete captured JSON and ordered immutable revision IDs are stored server-side before Ready. Ready then copies that exact capture with personal thesis/bias, strategy version, chart plan, explicit confirmations and missing-context acknowledgement. Review and linked trades read these snapshots, not current CMS text. Withdrawal notices are fetched separately from preserved content. Widget values are never read into a capture.

## Persistence, authorization and migrations

V67 extends `content_type`, `content_post`, and `content_post_translation` with typed `session_briefing` identities. Its canonical CMS parent remains DRAFT to prevent generic Mentor discovery from leaking typed drafts. Generic CMS update/publish/archive/delete is guarded for this type; only Session briefings administration publishes immutable typed revisions.

Tables: `session_briefing_revision`, `session_briefing_fact`, `session_briefing_event`, `content_publication_audit`, `preparation_briefing_composition`. Unique date/slot identity, revision/draft identity, request idempotency, stable fact/event indexes, FK composition references, and database triggers protect immutable revision/audit rows. Draft writes use compare-and-swap versions. Publication locks the canonical identity. Capture uses a repeatable-read transaction. Existing account-level review conflict protection and trade lineage are retained.

The existing CMS has revision notes and a version counter, but no append-only actor audit table; `content_publication_audit` adds that missing capability within the CMS extension. All reads require authentication. Draft/preview/history and all editorial mutations require ADMIN at controller and service boundaries. Private captures remain owner-scoped; account-scoped Ready revisions retain the existing authorization checks.

Migration verification on 2026-09-06:

- The original local `tradevault` database was at V59 and was left unchanged.
- An existing isolated QA template was already at V66.
- An isolated clone applied V67 through Flyway and validated existing checksums.
- A separate empty local database applied all 67 migrations successfully.
- No previously applied migration file/checksum was modified. Hosted/production migration state was not inspected or changed.

Normal startup uses Flyway; deploy the new migration through the existing release process only after backing up the target. Do not edit V60–V67 to reconcile another environment; investigate drift and add a migration where necessary. No new API keys, paid data service, news API, or OpenAI configuration are needed. Existing internal provider adapters remain available for legacy records.

## TradingView and optional metrics

See [the support matrix](tradingview-market-monitor.md). The current monitor is a secondary expandable block. Historical dates label it **Current market monitor — not historical context**. Review has no market monitor. A chart's daily OHLC display refers to its provider-selected candle; it is not an application-certified current-day range. The application makes no custom ATH or day-range calculation from widget data.

Prose is treated as plain text and React-escaped, including literal HTML/entities. It is never passed to an HTML or Markdown execution renderer. Source links are validated on both server and import UI. Unknown privileged/unsupported fields are rejected.

## Verification evidence

See `outputs/editorial-briefings/` for API results, screenshots, real iframe dimension measurements, migration proof and final check summaries. The API harness is `backend/scripts/verify_editorial_local.py` and deliberately rejects non-local API hosts. It uses synthetic QA users and should only be run against an isolated QA database. Browser tests used actual authenticated Admin and ordinary-user sessions. No production deployment or hosted browser run was performed.
