# SideQuest Backend – Architecture Skill

This document is the source of truth for *how* the SideQuest backend is structured and *why*. It is intended for engineers and AI agents extending the codebase.

> **Guiding principle:** modular monolith first, microservices never (until evidence justifies it). Every "scalable" choice below has a *cheap MVP form* and a *documented escape hatch*.

---

## 1. Backend architecture

### Stack and runtime

- NestJS 10 (TypeScript, strict mode) running on Node 20+.
- HTTP via `@nestjs/platform-express`. WebSocket via Socket.IO.
- Postgres 16 in production, same image locally.
- Process model: a single Node process per container. Horizontal scaling done via container replicas behind a load balancer.

### Bootstrap (`src/main.ts`)

The application bootstrap is intentionally explicit:

- `helmet()` + CORS allowlist.
- Global prefix `api` + URI versioning (`/api/v1`).
- `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`.
- `GlobalExceptionFilter` (HTTP + Prisma error mapping).
- `LoggingInterceptor` (per-request log line).
- `ResponseInterceptor` (envelope wrapping).
- Swagger mounted at `/api/docs` outside production.
- Shutdown hooks enabled so `OnModuleDestroy` is called on SIGTERM (Prisma closes its pool cleanly).

### Layering

```
HTTP (Controller)
   ↓ DTO (class-validator)
Service (use-case, transactions, events)
   ↓
Repository (Prisma client calls only)
   ↓
PrismaService (single shared Prisma client)
```

- **Controllers** never touch Prisma. They take DTOs and call services.
- **Services** own business logic, cross-repository transactions, and event emission.
- **Repositories** are thin Prisma wrappers. They expose intention-revealing methods, not raw `findMany` everywhere.
- **PrismaService** is the only place a `PrismaClient` is constructed. It exposes `runInTransaction()` for cross-repository atomicity.

### Cross-cutting concerns

| Concern        | Where                                                  |
|----------------|--------------------------------------------------------|
| Auth           | `JwtAuthGuard` registered as `APP_GUARD` globally      |
| Authorization  | `RolesGuard` + `@Roles(...)` on routes                 |
| Rate limiting  | `ThrottlerGuard` registered as `APP_GUARD` globally    |
| Errors         | `GlobalExceptionFilter`                                |
| Logging        | `LoggingInterceptor`                                   |
| Response shape | `ResponseInterceptor`                                  |
| Validation     | `ValidationPipe`                                       |

Routes opt out of auth with `@Public()`. Roles are additive: a route without `@Roles(...)` is open to any authenticated user.

---

## 2. Module patterns

### Folder shape

Each feature module has a consistent folder:

```
src/modules/<feature>/
  dto/                       # request + response DTOs (class-validator + Swagger metadata)
  <feature>.module.ts        # provider/controller wiring
  <feature>.controller.ts    # HTTP surface, thin
  <feature>.service.ts       # use-cases, transactions, events
  <feature>.repository.ts    # Prisma calls only
```

Optional siblings: `*.gateway.ts` (WebSocket), `*.consumer.ts` (BullMQ - future), `storage/` (driver abstractions for uploads).

### Module-level rules

1. **Repositories never throw HTTP exceptions.** They return data or null. Services translate to `NotFoundException` etc.
2. **Cross-module dependencies go through services**, not repositories. (Quests service → Users service, never Quests → UsersRepository directly.)
3. **`@Global()` is reserved** for truly app-wide singletons: `PrismaModule`, `EventsModule`, `GeoModule`. Everything else is explicitly imported.
4. **Events are the decoupling tool.** When quest completion needs to notify both achievements and notifications, the service emits a typed event; listeners subscribe.

### Conventional file map cheat sheet

| If you're adding...                | Touch...                                              |
|------------------------------------|-------------------------------------------------------|
| A new DB field                     | `prisma/schema.prisma`, regenerate, `prisma migrate dev` |
| A new endpoint                     | DTO → service method → controller method              |
| A new domain side effect           | Emit a new `AppEvents.*`, write a listener            |
| A new role                         | `AppRole` enum + `UserRole` enum in Prisma            |
| A new background job (future)      | Define a queue + processor; `EventsBus` triggers `add()` |

---

## 3. Prisma conventions

- **Primary keys** are CUIDs (`@default(cuid())`). Avoids exposing autoincrement IDs and is offline-friendly for clients.
- **Timestamps**: every persisted entity has `createdAt @default(now())` and `updatedAt @updatedAt`.
- **Cascades** are explicit:
  - Owned children (`QuestLocation`, `QuestCompletion`, `UserAchievement`, `Notification`) cascade on parent delete.
  - Soft references (`Quest.author`, `Quest.business`) use `SetNull` so quests outlive author/business deletes.
- **Soft delete is intentionally avoided** in MVP. Add `deletedAt` per-table only when product needs it.
- **Indexes**: every foreign key gets an index. Geo columns are indexed as a `(latitude, longitude)` composite to support bounding-box scans.
- **Enums** live in the Prisma schema; the API enum (`AppRole`) mirrors `UserRole` in code via an explicit mapper (`AuthService.roleFromUser`). Don't import `UserRole` into HTTP DTOs.
- **JSON columns** (`Quest.proof`, `Achievement.criteria`, `Notification.data`) are typed `Json` and accessed via dedicated guards in the engine that owns them. Don't pass raw `Prisma.JsonValue` into HTTP layers.
- **Transactions**: use `prismaService.runInTransaction(fn)` for cross-table writes (e.g., completing a quest updates `QuestCompletion` + `User.xp` + `User.questsDone` atomically).

### Migration etiquette

```bash
yarn prisma:migrate -- --name <descriptive-snake-case>
```

- Migrations live in `prisma/migrations/`.
- Never edit a committed migration; create a follow-up migration.
- `prisma migrate deploy` runs on container startup in `docker-compose.yml`.

---

## 4. DTO conventions

- DTOs are classes (not interfaces) so class-validator decorators have a runtime target.
- Request DTOs **always** carry `class-validator` decorators *and* `@ApiProperty(...)` / `@ApiPropertyOptional(...)`. Swagger and validation share the same source of truth.
- Response DTOs expose a static `fromEntity()` mapper. Controllers/services never leak Prisma rows directly. Sensitive fields (`passwordHash`, `refreshTokenHash`) must not be reachable from a DTO.
- Generic patterns live in `src/common/dto/`:
  - `PaginationQueryDto` (`page`, `limit`, `search`, `skip`, `take`).
  - `IdParamDto` (`@Param() params: IdParamDto`).
  - `GeoQueryDto` (`lat`, `lng`, `radiusM`).
- Avoid `as` casts. When you need narrowing, prefer:
  - Prisma typed inputs (`Prisma.UserWhereInput`).
  - Hand-written user-defined type guards (`function isX(value: unknown): value is X`).
  - `Reflect.get` for safe property access on `unknown`.

---

## 5. Auth architecture

### Tokens

- **Access token**: short-lived (`15m` default), signed with `JWT_ACCESS_SECRET`. Carries `{ sub, email, username, role }`.
- **Refresh token**: longer-lived (`7d` default), signed with a separate `JWT_REFRESH_SECRET`. Stored hashed (argon2) in `User.refreshTokenHash`. Rotated on every refresh.

### Flow

```
POST /auth/register   →  argon2 hash, create user, issue tokens, hash refresh, store hash
POST /auth/login      →  argon2 verify, issue new tokens, rotate refresh hash
POST /auth/refresh    →  verify refresh JWT signature + argon2 match → issue new pair
POST /auth/logout     →  null out refreshTokenHash (revokes refresh chain)
```

### Guards

- `JwtAuthGuard` is global. `@Public()` opts out (login/register/refresh/health/etc.).
- `RolesGuard` is opt-in per route with `@Roles(AppRole.ADMIN, ...)`.
- `JwtStrategy.validate()` looks up the *current* user and rejects suspended/deleted accounts even if the token is still cryptographically valid.

### Password storage

- argon2id with library defaults. Never log or return hashes.
- Password complexity is enforced at the DTO layer (`@Length(8, 128)` minimum; tighten later with a `@IsStrongPassword`-equivalent).

### Realtime auth

- Socket.IO clients pass the access token via `auth.token` (preferred) or `Authorization: Bearer ...` header.
- The gateway verifies the JWT *during connection*. Authenticated sockets join a `user:<id>` room used for fan-out.

---

## 6. Scalability principles

1. **Stateless API.** No in-memory session state. All persistent state in Postgres. Multiple replicas behind a load balancer scale linearly.
2. **One Prisma client per process.** Connection pool sizing tuned via `DATABASE_URL` query params (`?connection_limit=...`) when needed.
3. **Pagination is mandatory** on every list endpoint. Default `limit=20`, hard cap `limit=100`.
4. **Indexes are not optional.** Every WHERE/ORDER BY column on hot paths has an index. Geo queries pre-filter on indexed `(latitude, longitude)` columns before refining with Haversine.
5. **N+1 prevention.** Use Prisma `include` only with bounded depth. Prefer paginated child lists over deep includes for unbounded relations.
6. **Background work is queued, not in-request.** The `EventsBus` is the abstraction. MVP runs handlers in-process. The next evolution swaps the implementation to BullMQ enqueues with no controller-layer changes.
7. **Caching is added later, deliberately.** When read pressure is real, the candidates are: map pin queries (Redis with short TTL), public quest detail (CDN + cache-control headers), and category listings.
8. **Migrations are forward-only.** Never edit committed migrations; never rollback in production - write a follow-up migration.
9. **Multi-tenancy / multi-region is solved by data, not code.** When SideQuest expands beyond Prague, we add a `region` column to spatial tables and partition or shard along that key. The geolocation strategy (below) makes that mechanical.
10. **Observability:** request logging today; OpenTelemetry tracing + Prometheus metrics in the next phase. Keep handlers small so middleware can wrap them.

---

## 7. Geolocation strategy

SideQuest is fundamentally a geospatial product. The architecture supports three phases:

### Phase 1 – MVP (current)

- `latitude: Float`, `longitude: Float` columns on `QuestLocation` and `Business`.
- Composite index `@@index([latitude, longitude])` enables bounding-box range scans.
- `GeoService` provides:
  - `boundingBox(center, radiusMeters)` → SQL prefilter.
  - `haversineMeters(a, b)` → exact distance refinement in JS.
  - `isWithinRadius(center, point, radiusMeters)` → convenience predicate.
- Query pattern:
  1. Client sends `lat, lng, radiusM` or `north/south/east/west`.
  2. Service builds bounding box, runs indexed WHERE.
  3. Service refines via Haversine for circular queries.
- Pros: zero infra dependencies, works on plain Postgres.
- Cons: bounding-box is square (≤ ~25% overshoot), no native distance ordering at SQL level.

### Phase 2 – PostGIS

- Enable extension: `CREATE EXTENSION postgis;`.
- Migrate `latitude`/`longitude` to a single `geog geography(Point, 4326)` column.
- Replace bounding-box + Haversine with `ST_DWithin(geog, ST_MakePoint(lng, lat)::geography, radius)`.
- Add `CREATE INDEX ... USING GIST (geog)` for true spatial indexing.
- The service interface (`GeoService.isWithinRadius`, "nearby" endpoints) stays unchanged.

### Phase 3 – Scale-out

- Pre-compute geohash tiles for hot regions; cache pin payloads in Redis with short TTLs.
- Region-partition spatial tables (e.g., `quest_location_prague`, `quest_location_berlin`) using Postgres declarative partitioning if global rollout demands it.
- Optional read replicas for map-pin queries.

### Conventions today

- Never store distances; compute them on read.
- Never trust client-supplied "I'm here" coordinates for XP-awarding without proof: `QuestCompletion.proof` is a JSON blob designed to capture (timestamp, lat/lng, optional photo digest) for fraud review.

---

## 8. Notification strategy

Notifications are abstracted into four concerns:

```
┌─────────────────┐   emit    ┌────────────┐  fan-out  ┌──────────────────────┐
│ Domain Service  ├──────────▶│ EventsBus  ├──────────▶│ NotificationsService │
└─────────────────┘           └────────────┘           └─────────┬────────────┘
                                                                │ persist
                                                                ▼
                                                       ┌─────────────────┐
                                                       │ notifications DB│
                                                       └─────────────────┘
                                                                │ push
                                                                ▼
                                                  ┌────────────────────────────┐
                                                  │ NotificationsGateway (WS)  │
                                                  └────────────────────────────┘
```

### MVP transports

1. **DB record** in `Notification` (always, for the `/notifications` REST list).
2. **WebSocket push** to `user:<id>` room via `NotificationsGateway` (best-effort).

### Future transports (no architectural change)

- **Email** (transactional - SES / Resend / Postmark).
- **Push** (FCM / APNs).
- **SMS** (Twilio).

Each transport becomes a *delivery adapter* invoked by `NotificationsService.send()`. The adapter list is config-driven (`NOTIFICATIONS_ENABLED`, per-channel toggles). When BullMQ is wired, slow transports (email/SMS) are moved out of the request path into queues.

### Event types

Defined in `src/modules/events/events.types.ts`. Always:

1. Add a const in `AppEvents`.
2. Add a typed payload interface.
3. Emit via `eventsBus.emit(AppEvents.X, payload)`.
4. Subscribe in `OnModuleInit` of the consuming service.

This pattern is what makes the gamification engine, notification fan-out, and future WebSocket presence completely decoupled from the domain services that *cause* the events.

### Realtime channel

- Namespace: `/realtime`.
- Auth: JWT during `handleConnection`.
- Rooms: one `user:<id>` per authenticated socket; `pushToUser()` is the only emit entry point in MVP.
- Production note: to fan-out across replicas, add `@socket.io/redis-adapter` and point it at the Redis defined in `redis.config.ts`. No callsite changes required.

---

## 9. Quick reference – "Where do I put...?"

| Concern                                 | Location                                                         |
|-----------------------------------------|------------------------------------------------------------------|
| New env var                             | `.env.example` + `src/config/env.validation.ts` + a `*.config.ts` |
| New role                                | `AppRole` (enum) + `UserRole` (Prisma) + role mapper             |
| New domain event                        | `src/modules/events/events.types.ts`                             |
| New geo helper                          | `src/modules/geo/geo.service.ts`                                 |
| New uploadable type / storage backend   | implement `StorageDriver`, swap provider binding in `UploadsModule` |
| New WebSocket event                     | `NotificationsGateway` (or a sibling gateway per feature)        |
| New achievement type                    | extend `AchievementType` enum + branch in `AchievementsService.evaluate()` |
