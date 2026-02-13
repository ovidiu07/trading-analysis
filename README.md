# TradeVault

TradeVault is a Java + React application for tracking trades and generating analytics dashboards. It includes a Spring Boot backend, React/MUI frontend, PostgreSQL database, and Docker-based local setup.

## Prerequisites
- Java 21
- Maven
- Node.js 20+
- Docker & docker-compose

## Project structure
- `backend/` – Spring Boot API (JWT auth, trades, tags, analytics, CSV import/export)
- `frontend/` – React + TypeScript UI (Vite, MUI, TanStack Query, Recharts)
- `docker-compose.yml` – local stack with PostgreSQL, backend, frontend

## Running locally with docker-compose
```bash
docker-compose up --build
```
Services:
- Backend: http://localhost:8080
- Frontend: http://localhost:4173
- Postgres: localhost:5432

## Backend development
```bash
cd backend
mvn spring-boot:run
```

### Run migrations
Flyway runs automatically on startup. To trigger manually:
```bash
mvn -DskipTests=false flyway:migrate
```

### Run tests
```bash
cd backend
mvn test
```

## Frontend development
```bash
cd frontend
npm install
npm run dev
```

### Frontend UI title policy (no duplicates)
- Route-level page titles/subtitles are centralized in `frontend/src/config/routeMeta.ts`.
- `Layout` resolves route metadata and passes the title/subtitle to the shared `TopBar` once.
- When a page must own its in-content title (for example detail/editor flows), set `showHeader: false` in route metadata and render the local header in the page.
- A guard test (`frontend/src/config/routeMeta.guard.test.ts`) prevents reintroducing duplicate page-level route titles on primary pages.

## Analytics (GA4)
GA4 is integrated for the SPA shell and route navigation.

### Configuration
- Measurement ID env: `VITE_GA_MEASUREMENT_ID`
- Fallback ID when env is missing: `G-8H5HCBG170`
- Dev toggle: `VITE_GA_ENABLE_IN_DEV=true` (disabled by default in local/dev)

### Integration points
- Global HTML tag injection:
  - SPA/app shell (`/login`, `/register`, authenticated routes): `frontend/index.html`
  - SEO/landing pages (`/en/*`, `/ro/*`): generated from `frontend/scripts/generate-seo-pages.mjs` into `frontend/public/*`
- GA utility + event helpers: `frontend/src/utils/analytics/ga4.ts`
- One-time GA initialization at app bootstrap: `frontend/src/main.tsx`
- SPA route page views (`page_view` via `gtag('config', ...)` on navigation): `frontend/src/App.tsx`
- Outbound external links (`outbound_link_click`) are tracked globally via delegated click listener in `frontend/src/utils/analytics/ga4.ts`

### Events currently tracked
- `auth_sign_up_submit`: `frontend/src/pages/RegisterPage.tsx`
- `auth_login_submit`: `frontend/src/pages/LoginPage.tsx`
- `auth_email_confirm_view`: `frontend/src/pages/CheckEmailPage.tsx`
- `auth_email_confirm_view`: `frontend/src/pages/VerifyEmailPage.tsx`
- `demo_data_remove_click`: `frontend/src/components/demo/DemoDataBanner.tsx`
- `trade_create_submit`: `frontend/src/pages/TradesPage.tsx`
- `trade_import_start`: `frontend/src/pages/TradesPage.tsx`
- `trade_import_success`: `frontend/src/pages/TradesPage.tsx`
- `trade_import_fail`: `frontend/src/pages/TradesPage.tsx`
- `filter_apply` (Trades): `frontend/src/pages/TradesPage.tsx`
- `filter_apply` (Analytics): `frontend/src/pages/AnalyticsPage.tsx`
- `insights_view`: `frontend/src/pages/InsightsPage.tsx`
- `outbound_link_click`: `frontend/src/utils/analytics/ga4.ts`

### Validation checklist (GA4 Realtime / DebugView)
1. Open the app and verify first `page_view` appears.
2. Navigate between routes (`/dashboard`, `/trades`, `/analytics`, etc.) and confirm one `page_view` per navigation.
3. Trigger each tracked action and confirm one corresponding event per interaction.
4. Confirm no console errors related to GA and only one GA script tag (`#ga4-gtag-js`) in DOM.
5. Verify server HTML source includes `G-8H5HCBG170` on both:
   - SEO page source (for example `/en/`, `/en/features/`)
   - SPA source (for example `/login` or `/register`)

### Dark theme contrast tokens
- Dark mode typography and surface tokens are defined in `frontend/src/theme.ts` (for example: `palette.text.primary`, `palette.text.secondary`, `palette.text.disabled`, link colors, surface/border tones).
- Prefer theme tokens and component overrides (`MuiDataGrid`, `MuiTableCell`, `MuiInputBase`, `MuiChip`, etc.) over one-off hardcoded colors.
- For charts and custom UI blocks, use theme-derived colors (`theme.palette.*`, `alpha(...)`) so contrast remains consistent on dark surfaces.

## Internationalization (i18n)
- Frontend locale files live in:
  - `frontend/src/i18n/en.json`
  - `frontend/src/i18n/ro.json`
- Runtime setup is in `frontend/src/i18n/index.tsx` and is loaded from `frontend/src/main.tsx`.

### Add a new translation key
1. Add the key in `frontend/src/i18n/en.json`.
2. Add the same key in `frontend/src/i18n/ro.json`.
3. Use it in UI code with `const { t } = useI18n()` and `t('your.key.path')`.
4. For API/server errors, map codes in `frontend/src/i18n/errorMessages.ts` and use `translateApiError(...)`.

### Add a new language
1. Create a new locale JSON file in `frontend/src/i18n/` (for example `fr.json`).
2. Register it in `frontend/src/i18n/index.tsx`:
   - extend `AppLanguage`
   - add `LOCALES` entry
   - add `RESOURCES` entry
   - add language option in `Layout.tsx` language selector.

### Language persistence and default
- Selected language is persisted in `localStorage` under key `app.language`.
- Startup language resolution:
  1. Use `app.language` from localStorage if present (`en` or `ro`).
  2. Otherwise, use browser language (`ro*` -> Romanian, otherwise English).
  3. Fallback for missing keys is English.

## Production builds
- Backend JAR: `mvn clean package`
- Frontend static bundle: `npm run build` (served by Nginx via frontend Dockerfile)

## Environment variables
- `DB_URL` – JDBC connection string
- `DB_USER` – database user
- `DB_PASS` – database password
- `JWT_SECRET` – JWT signing secret
- `JWT_EXPIRY` – token expiry in milliseconds
- `FRONTEND_URL` – allowed CORS origin

### Asset storage (AWS S3 + MinIO compatible)
- `STORAGE_PROVIDER` – storage provider (`s3`)
- `STORAGE_S3_ENABLED` – enable/disable S3-backed storage (default `true`)
- `STORAGE_S3_BUCKET` – bucket name
- `STORAGE_S3_REGION` / `AWS_REGION` – AWS region
- `STORAGE_S3_ENDPOINT` – custom endpoint (required for MinIO, optional for AWS)
- `STORAGE_S3_ACCESS_KEY` / `AWS_ACCESS_KEY_ID` – access key
- `STORAGE_S3_SECRET_KEY` / `AWS_SECRET_ACCESS_KEY` – secret key
- `STORAGE_S3_ACCESS_KEY_FILE`, `STORAGE_S3_SECRET_KEY_FILE` – file-based secrets (Docker secrets style)
- `STORAGE_S3_PUBLIC_BASE_URL` – optional CDN/public base URL
- `STORAGE_S3_PATH_STYLE` / `STORAGE_S3_PATH_STYLE_ACCESS` – `true` for most MinIO setups
- `STORAGE_S3_FORCE_PATH_STYLE` – force path-style addressing
- `STORAGE_S3_USE_IAM_ROLE` – use AWS SDK default credential chain (IAM/IRSA/ECS task role)
- `STORAGE_S3_PROFILE_NAME` – explicit AWS profile name (optional)
- `STORAGE_S3_PRESIGN_ENABLED` – `true` to return short-lived pre-signed URLs
- `STORAGE_S3_PRESIGN_EXPIRATION_MINUTES` – pre-signed URL TTL (default `60`)
- `UPLOADS_MAX_FILE_SIZE_MB` – max upload size per file (default `20`)
- `UPLOADS_ALLOWED_MIME_TYPES` – comma-separated allowlist

Default allowlist:
- `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- `application/pdf`, `text/plain`, `text/csv`, `application/json`
- `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Example (AWS S3):
```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=tradejaudit-prod-assets
STORAGE_S3_REGION=eu-central-1
STORAGE_S3_ACCESS_KEY=...
STORAGE_S3_SECRET_KEY=...
STORAGE_S3_USE_IAM_ROLE=false
STORAGE_S3_PRESIGN_ENABLED=true
STORAGE_S3_PRESIGN_EXPIRATION_MINUTES=60
UPLOADS_MAX_FILE_SIZE_MB=20
```

Example (MinIO):
```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=tradejaudit-assets
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ENDPOINT=http://127.0.0.1:9000
STORAGE_S3_PATH_STYLE=true
STORAGE_S3_ACCESS_KEY=minioadmin
STORAGE_S3_SECRET_KEY=minioadmin
STORAGE_S3_PRESIGN_ENABLED=true
UPLOADS_MAX_FILE_SIZE_MB=20
```

## API Docs
OpenAPI/Swagger UI available at `/swagger-ui/index.html` once the backend is running.

## Notebook module
The Notebook module adds a three-pane journaling workspace for daily logs, trade notes, plans/goals, and session recaps. It syncs daily P&L stats from closed trades (timezone-aware) and supports tags, templates, and attachments.

### Notebook API endpoints
- Folders: `GET /api/notebook/folders`, `POST /api/notebook/folders`, `PATCH /api/notebook/folders/:id`, `DELETE /api/notebook/folders/:id`
- Notes: `GET /api/notebook/notes`, `GET /api/notebook/notes/:id`, `POST /api/notebook/notes`, `PATCH /api/notebook/notes/:id`, `DELETE /api/notebook/notes/:id`, `POST /api/notebook/notes/:id/restore`
- Tags: `GET /api/notebook/tags`, `POST /api/notebook/tags`, `DELETE /api/notebook/tags/:id`, `POST /api/notebook/notes/:id/tags`
- Assets: `POST /api/assets/upload` (`scope=NOTEBOOK&noteId=...`), `GET /api/assets/notebook/:noteId`, `DELETE /api/assets/:assetId`, `GET /api/assets/:assetId/download`, `GET /api/assets/:assetId/view`
- Templates: `GET /api/notebook/templates`, `POST /api/notebook/templates`, `PATCH /api/notebook/templates/:id`, `DELETE /api/notebook/templates/:id`
- Daily stats: `GET /api/trades/daily-summary?date=YYYY-MM-DD&tz=Europe/Bucharest`
- Loss recap: `GET /api/trades/losses?from=YYYY-MM-DD&to=YYYY-MM-DD&minLoss=50&tz=Europe/Bucharest`

### Notebook migrations
Notebook entities live in `backend/src/main/resources/db/migration/V2__notebook.sql`. Run migrations with:
```bash
cd backend
mvn -DskipTests=false flyway:migrate
```

## Insights publishing
Admins can create and publish strategies + weekly plans for all authenticated users to read in the Insights section.

### Publish flow
1. Visit `/admin/content` (ADMIN only) to see all drafts, published items, and archived items.
2. Click “Create new” to draft a strategy or weekly plan.
3. Save as draft, then publish when ready. Published items are visible at `/insights` for all signed-in users.

### Content endpoints
- Admin CRUD: `POST /api/admin/content`, `PUT /api/admin/content/{id}`, `POST /api/admin/content/{id}/publish`, `POST /api/admin/content/{id}/archive`, `DELETE /api/admin/content/{id}`
- Read-only: `GET /api/content?type=STRATEGY|WEEKLY_PLAN&activeOnly=true`, `GET /api/content/{idOrSlug}`
- Content assets: `POST /api/assets/upload` (`scope=CONTENT&contentId=...`), `GET /api/assets/content/{contentId}`, `DELETE /api/assets/{assetId}`, `GET /api/assets/{assetId}/download`, `GET /api/assets/{assetId}/view`
