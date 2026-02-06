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
