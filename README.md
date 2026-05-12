# SideQuest – Backend

> Gamified exploration platform. Discover real-world places, complete quests, gain XP, unlock achievements, and socialize. Initial scope: Prague. Designed for global expansion.

---

## Stack

| Layer            | Tech                                                          |
|------------------|---------------------------------------------------------------|
| Framework        | [NestJS 10](https://nestjs.com) + TypeScript (strict mode)    |
| ORM              | [Prisma 5](https://www.prisma.io)                             |
| Database         | PostgreSQL 16                                                 |
| Auth             | JWT (access + refresh), Passport, argon2 password hashing     |
| Validation       | class-validator + class-transformer                           |
| Docs             | Swagger / OpenAPI                                             |
| Realtime         | Socket.IO gateway (`/realtime` namespace)                     |
| Containerization | Docker + docker-compose                                       |
| Security         | Helmet, CORS allowlist, global throttler                      |
| Future-ready     | BullMQ jobs, Redis pub/sub, external notification providers   |

---

## Project layout

```
src/
  main.ts                       # bootstrap, Swagger, global pipes/filters/interceptors
  app.module.ts                 # root module wiring
  config/                       # registerAs-based config + env validation
  prisma/                       # PrismaModule + PrismaService abstraction
  common/
    auth/                       # roles enum, AuthenticatedUser interface
    decorators/                 # @Public, @Roles, @CurrentUser, @ApiPaginatedResponse
    dto/                        # PaginationQueryDto, IdParamDto, GeoQueryDto
    filters/                    # GlobalExceptionFilter (HTTP + Prisma error mapping)
    guards/                     # JwtAuthGuard, RolesGuard
    interceptors/               # ResponseInterceptor, LoggingInterceptor
    responses/                  # API envelope, pagination helpers
  modules/
    auth/                       # register, login, refresh, logout, JWT strategy
    users/                      # me, list, profile updates
    quests/                     # list, nearby, start, complete (+ XP transaction)
    achievements/               # data-driven gamification engine
    map/                        # bounding-box pin queries
    friendships/                # request, accept, block, list
    businesses/                 # business directory
    notifications/              # gateway + service + REST listing
    uploads/                    # local storage driver (S3-ready abstraction)
    geo/                        # Haversine + bounding-box utilities
    events/                     # in-process pub/sub (BullMQ swap-in target)
    health/                     # /health probe
prisma/
  schema.prisma                 # data model
  seed.ts                       # idempotent dev seed
scripts/
  generate-openapi.ts           # produces openapi.yaml from live Nest controllers
openapi.yaml                    # checked-in OpenAPI 3.0 spec (regenerated on commit)
docker-compose.yml              # postgres + api
Dockerfile                      # multi-stage production image
```

---

## Getting started

### 1. Prerequisites

- Node.js ≥ 20
- Yarn (classic 1.22+)
- Docker + docker-compose

### 2. Configure environment

```bash
cp .env.example .env
# Edit JWT secrets at minimum
```

### 3. Run with Docker (recommended)

```bash
docker compose up -d --build
```

This starts Postgres and the API, runs `prisma migrate deploy` on boot, and exposes:

- API: <http://localhost:3000/api/v1/...>
- Health: <http://localhost:3000/api/v1/health>
- Swagger UI: <http://localhost:3000/api/docs>
- WebSocket: `ws://localhost:3000/realtime`

`FRONTEND_URL` defaults to `http://localhost:5173` inside the container too,
so a locally-running Vite frontend can hit the dockerised API without any
extra config.

### 4. Run locally (Node, against Dockerised Postgres)

```bash
docker compose up -d db
yarn install                            # also installs husky pre-commit hook
yarn prisma:generate
yarn prisma:migrate --name init
yarn prisma:seed
yarn start:dev
```

### 5. Useful scripts

| Script                | Purpose                                          |
|-----------------------|--------------------------------------------------|
| `yarn start:dev`      | Hot-reload dev server                            |
| `yarn build`          | Compile to `dist/`                               |
| `yarn start:prod`     | Run compiled output                              |
| `yarn format`         | Prettier (write)                                 |
| `yarn format:check`   | Prettier (check only - CI-friendly)              |
| `yarn lint`           | ESLint (check only - the pre-commit gate)        |
| `yarn lint:fix`       | ESLint with `--fix`                              |
| `yarn typecheck`      | `tsc --noEmit`                                   |
| `yarn test`           | Unit tests (Jest)                                |
| `yarn prisma:studio`  | Prisma Studio (DB GUI)                           |
| `yarn prisma:seed`    | Idempotent seed for dev                          |
| `yarn db:reset`       | Drop + recreate DB + re-run migrations           |
| `yarn openapi:generate` | Regenerate the checked-in `openapi.yaml`       |

### 6. Pre-commit hook (husky)

`yarn install` runs the `prepare` script which installs husky's git hooks. On every commit the following runs:

```sh
yarn format            # prettier --write
yarn openapi:generate  # regenerate openapi.yaml from live controllers/DTOs
git add .              # stage any reformatting + new openapi.yaml
yarn typecheck         # tsc --noEmit (includes prisma/seed.ts and scripts/)
yarn lint              # eslint check
```

If `yarn typecheck`, `yarn lint`, or `yarn openapi:generate` exits non-zero,
the commit is blocked. The OpenAPI generator boots `AppModule` with
`SKIP_PRISMA_CONNECT=1`, so it does **not** require a running Postgres -
commits work offline.

`openapi.yaml` is checked into the repo as the canonical machine-readable
contract: frontend clients can codegen against it, and PR diffs make API
changes reviewable at a glance.

---

## Frontend integration (local)

The backend is built to talk to a Vite-based React frontend on the same machine.
Out of the box the configuration assumes:

| Service  | URL                              |
|----------|----------------------------------|
| Backend  | `http://localhost:3000`          |
| API base | `http://localhost:3000/api/v1`   |
| Swagger  | `http://localhost:3000/api/docs` |
| Frontend | `http://localhost:5173`          |

### CORS

CORS is environment-driven. The final allowlist is the union of:

- `FRONTEND_URL` (single primary origin - the React app's base URL)
- `CORS_ORIGINS` (comma-separated extras for previews / native shells)
- `http://localhost:5173` and `http://127.0.0.1:5173` (auto-added in non-production)

`credentials: true` is enabled, so the frontend can send cookies / `Authorization`
headers in cross-origin requests. Blocked origins are logged with a `CORS` tag
in the server console so you can see exactly what was rejected.

When you move to production, set `FRONTEND_URL=https://app.sidequest.example` and
leave `CORS_ORIGINS` empty (or add preview URLs).

### Frontend `.env`

In your React app's `.env` use one variable for the base URL so domain switching
is a single config change:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Then in code:

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});
```

### Verifying the connection

Once the backend is running you can sanity-check connectivity:

```bash
# 1. Liveness (no DB hit, safe even before migrations)
curl -i http://localhost:3000/api/v1/health
# → { "success": true, "message": "SideQuest API running", ... }

# 2. DB readiness
curl -i http://localhost:3000/api/v1/health/db
# → { "success": true, "message": "Database reachable", "db": "up", ... }

# 3. CORS preflight from the Vite origin
curl -i -X OPTIONS http://localhost:3000/api/v1/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
# → 204 with Access-Control-Allow-Origin: http://localhost:5173
```

If the frontend gets CORS errors, check the backend log for a
`[CORS] Blocked CORS origin: ...` warning - it will name the exact origin that
needs adding to `FRONTEND_URL` or `CORS_ORIGINS`.

Every request is also access-logged with origin + IP + status (the `HTTP` log
namespace), which makes it trivial to confirm the frontend is actually hitting
the backend.

---

## API conventions

- **Base URL:** `/api/v1/...` (URI versioning, default v1).
- **Auth:** Bearer JWT in `Authorization` header. Routes default to authenticated; opt-out with `@Public()`.
- **Success envelope:** `{ "success": true, "data": ..., "meta": { ... } }`.
- **Error envelope:** `{ "success": false, "error": { "code", "message", "details" }, "meta": { ... } }`.
- **Pagination:** `?page=1&limit=20&search=...` → `meta.pagination = { page, limit, total, totalPages, hasNext, hasPrev }`.
- **Geo queries:** `?lat=...&lng=...&radiusM=...` for "nearby" endpoints; `?south&north&west&east` for map bounds.

See Swagger UI for the full contract.

---

## Default seeded credentials (dev only)

| Role  | Email                       | Password        |
|-------|-----------------------------|-----------------|
| ADMIN | `admin@sidequest.dev`       | `AdminPass123!` |
| USER  | `wanderer@sidequest.dev`    | `UserPass123!`  |
| USER  | `foodie@sidequest.dev`      | `UserPass123!`  |

---

## What is intentionally out of scope (yet)

- Microservices split. Modular monolith on purpose for MVP speed.
- PostGIS. We use plain `Float` lat/lng + bounding-box prefilter + Haversine refine. Migration path is documented in `SKILL.md`.
- BullMQ workers. The architecture is *ready* for them (events bus, Redis config, notification dispatch fan-out). Not wired until needed.
- External notification transports (email/FCM/APNs). DB + WebSocket only for MVP.

See `SKILL.md` for the full architecture rationale and `AGENTS.md` for the agent personas that own each concern.
