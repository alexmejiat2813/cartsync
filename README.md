# CartSync API

Backend REST API for a market list management app. Built with NestJS 10, Prisma 5, and PostgreSQL 16.

## Live

| | URL |
|--|--|
| API | https://cartsync-api.fly.dev/v1 |
| Docs (Swagger) | https://cartsync-api.fly.dev/docs |
| Health | https://cartsync-api.fly.dev/health |

## Stack

- **Runtime**: Node.js 20 + NestJS 10 + TypeScript 5
- **ORM**: Prisma 5 + PostgreSQL 16
- **Auth**: JWT access token (15m) + refresh token in HttpOnly cookie (7d, rotation on every use)
- **Storage**: Tigris / AWS S3 — private bucket + presigned URLs
- **Docs**: OpenAPI 3.1 via `@nestjs/swagger` at `/docs`
- **Deploy**: Fly.io (Dallas) with managed Postgres
- **CI/CD**: GitHub Actions — tests on every PR, deploy on push to `main`

## Features

| Module | Endpoints |
|--------|-----------|
| Auth | register, login, refresh, logout, profile |
| Supermarkets | CRUD + pagination + search + soft delete |
| Lists | CRUD + filter by status/supermarket + auto total on complete |
| Products | CRUD nested under lists + atomic total recalculation |
| Barcode | Open Food Facts lookup with 7-day local cache |
| Media | S3 upload + presigned URL retrieval |

## Security

- Passwords: bcrypt 12 rounds
- Refresh tokens: stored as SHA-256 hash only
- Ownership: 403 (never 404) to prevent resource enumeration
- Rate limiting: 100 req/min global, 30 req/min barcode, 5/min register
- Soft delete on lists and supermarkets

## Local Setup

**Requirements**: Node 20, Docker (for Postgres)

```bash
# 1. Clone and install
git clone https://github.com/alexmejiat2813/cartsync.git
cd cartsync
npm install

# 2. Start Postgres
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — DATABASE_URL and JWT_SECRET are required

# 4. Run migrations and seed
npx prisma migrate dev
npm run db:seed

# 5. Start dev server
npm run start:dev
# API at http://localhost:3000/v1
# Swagger at http://localhost:3000/docs
```

## Testing

```bash
npm test                                                    # unit tests (23)
npx jest --config test/jest-e2e.json --runInBand --forceExit  # e2e tests (24)
```

## Environment Variables

See `.env.example` for the full list. Required in all environments:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars — generate with `openssl rand -base64 32` |

AWS/Tigris variables are optional in development and required in production.

## Deployment

CI/CD is configured via GitHub Actions. Every push to `main` runs tests and deploys to Fly.io.

**Manual deploy**:
```bash
fly deploy
```

**Add FLY_API_TOKEN to GitHub**:
```bash
fly tokens create deploy -x 999999h
# Add output as GitHub secret: Settings → Secrets → FLY_API_TOKEN
```
