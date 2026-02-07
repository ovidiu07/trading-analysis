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
- `UPLOAD_DIR` – local upload directory
- `FRONTEND_URL` – allowed CORS origin

## API Docs
OpenAPI/Swagger UI available at `/swagger-ui/index.html` once the backend is running.

## Notebook module
The Notebook module adds a three-pane journaling workspace for daily logs, trade notes, plans/goals, and session recaps. It syncs daily P&L stats from closed trades (timezone-aware) and supports tags, templates, and attachments.

### Notebook API endpoints
- Folders: `GET /api/notebook/folders`, `POST /api/notebook/folders`, `PATCH /api/notebook/folders/:id`, `DELETE /api/notebook/folders/:id`
- Notes: `GET /api/notebook/notes`, `GET /api/notebook/notes/:id`, `POST /api/notebook/notes`, `PATCH /api/notebook/notes/:id`, `DELETE /api/notebook/notes/:id`, `POST /api/notebook/notes/:id/restore`
- Tags: `GET /api/notebook/tags`, `POST /api/notebook/tags`, `DELETE /api/notebook/tags/:id`, `POST /api/notebook/notes/:id/tags`
- Attachments: `POST /api/notebook/attachments`, `GET /api/notebook/attachments/:id`, `GET /api/notebook/attachments?noteId=...`, `DELETE /api/notebook/attachments/:id`
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
