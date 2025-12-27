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
