# Chart + trade plan workspace — implementation and validation

Implemented locally on 5 October 2026. Not deployed. Screenshots show the actual local application with synthetic account/plan API responses. TradingView and Tradays remain external public embeds; these screenshots are not proof of provider coverage or production data.

## Delivered behavior

- Default Today preparation workspace: large chart left, one trade-plan panel right, responsive stacking on small screens.
- Compact account/date/session toolbar; instrument selection above the chart. Setup, direction, checklist, risk, written plan and psychology stay together.
- News/calendar and market context open on demand; unavailable event alerts remain visible.
- Emotion, discipline flags, psychology notes, session notes, checklist labels and raw risk drafts now persist in the account/date/session review.
- Execution handoff carries a complete preparation snapshot. Logging flushes the latest execution-workspace edits before opening Quick Log and stays on the workspace if saving fails.
- The final trade stores the original preparation plus the final submitted trade values. The backend also copies the latest setup and session configuration when a setup is linked.
- Journal expanded-trade and edit views, plus Today review, show the captured preparation with expandable configuration.
- Later session/strategy edits and trade-note corrections do not overwrite the original preparation record. Current trade fields can still be edited normally.
- Legacy manual setups without an account remain loggable. Old trades without preparation retain a null snapshot; no historical data is fabricated.

## Fields captured

Full session review (including thesis, chart plan, selected symbol/timeframe, context acknowledgments, manual levels and existing source references), current strategy definition, setup checklist labels/values, emotion and discipline flags, psychology/session notes, scoped raw risk drafts, calculated risk and capacity available at handoff. For linked execution setups: strategy, trigger, execution tickets, review, narrative, levels, confluences, mentor reference and session risk/lock-in configuration. The final submitted trade values include feeling, notes, prices, quantity, intended risk, currencies and contract multiplier.

## Validation results

- Full frontend suite: **75 files passed; 376 tests passed; 10 existing skipped tests**.
- After final review fixes: Today integration tests **10 passed**, risk/preparation tests **6 passed**.
- Frontend TypeScript + production build passed. Existing Vite large-chunk warning remains.
- Focused backend tests: **69 passed** (35 TradeService, 15 SessionReviewService, 16 SessionWorkspaceService, 3 authenticated database integration tests).
- Real PostgreSQL 16 Testcontainers instance; Flyway successfully applied all **74 migrations**, including V74.
- Authenticated API flow tested with real JWT authentication: save/reload review, direct Today logging, idempotent retry without duplicate trade, subsequent edits preserving original snapshot, setup create/update/Quick Log with latest notes, final risk edit, database/API roundtrip, cross-user rejection and preparation-account mismatch rejection.
- Frontend flow regression tests: latest-field snapshot handoff, last-second execution edit flushed before navigation, failure prevents navigation, setup identity/feeling/contract multiplier retained through form validation.
- Chromium browser QA: desktop 1600×1100 and mobile 390×844, no horizontal overflow or page errors; risk, psychology and notes survive reload; Calendar drawer opens and Escape closes. Application API responses in this browser check are mocked; authenticated persistence is proven separately by the database integration tests.
- `git diff --check` passed.

## Reproduce

Frontend: `cd frontend && npx vitest run` and `npm run build`.

Backend with Java 21 and Docker running:
`mvn -f backend/pom.xml -Dapi.version=1.44 -Dtest=TradePreparationFlowIntegrationTest,SessionReviewServiceTest,SessionWorkspaceServiceTest,TradeServiceTest test`

Browser: start a local frontend on 127.0.0.1:5178, then run `browser-qa.cjs` with Playwright available. Optionally set TJA_BROWSER_EXECUTABLE, TJA_BASE_URL and TJA_SCREENSHOT_DIR. The harness intercepts application API requests and writes only synthetic test data.

## Boundaries and rollout

- V74 adds `trades.preparation_snapshot` as JSONB. Apply the migration with the backend release before using the new UI against that backend.
- No production trade/account data was changed. No deployment, commit or push was performed.
- TradingView drawings and indicator changes inside its external iframe cannot be read or saved by this application. The app-controlled chart symbol/timeframe and written plan are captured. Standalone notebook documents remain separate records; plan, session, psychology and execution notes entered in this workflow are captured.
- The calendar drawer opened correctly, but the external Tradays embed returned 404 in the local browser run. The fallback link and coverage warning remain available; external calendar loading was not verified successfully.
- Tradays display remains independent of authorized structured event coverage. An embedded calendar does not establish complete application-checked alerts.
- Integration tests use Flyway-created schema and actual database writes. Hibernate global schema validation was disabled in this isolated test because an existing unrelated asset-scope enum mapping reports a VARCHAR/NAMED_ENUM mismatch. These tests do not certify that unrelated mapping.

## Screenshots

- [Default desktop workspace](desktop.png)
- [Psychology expanded](psychology.png)
- [Calendar drawer](calendar.png)
- [Mobile workspace](mobile.png)
