# CartSync — Task Tracker

> Estado: `[ ]` pendiente · `[~]` en progreso · `[x]` completo · `[!]` bloqueado

---

## Fase 0: Infraestructura Base

- [x] **0.1** Inicializar proyecto NestJS y dependencias (`package.json`, `app.module.ts`, `nest-cli.json`)
- [x] **0.2** ConfigModule global + validación Joi de env vars
- [x] **0.3** PrismaService global + migración inicial (6 tablas) — *schema listo, migración requiere BD activa*
- [x] **0.4** Infraestructura compartida: `JwtAuthGuard`, `CurrentUser`, `HttpExceptionFilter`, `PaginationInterceptor`

**CHECKPOINT 0** — build limpio + Swagger UI + BD migrada

---

## Fase 1: Auth

- [x] **1.1** AuthModule: registro, login, JWT access token, refresh token en cookie HttpOnly
- [x] **1.2** Refresh token rotation + logout

**CHECKPOINT 1** — flujo login → ruta protegida → refresh → logout funcional

---

## Fase 2: Supermercados

- [x] **2.1** SupermarketsModule: CRUD completo + paginación + búsqueda + ownership

**CHECKPOINT 2** — CRUD supermercados funcional con isolation entre usuarios

---

## Fase 3: Listas y Productos

- [x] **3.1** ListsModule: CRUD + filtros por status/supermarket + cálculo de total al completar
- [x] **3.2** ProductsModule: CRUD nested bajo `/lists/:listId/products` + recálculo de total en transacción

**CHECKPOINT 3** — flujo crear lista → añadir productos → completar → total correcto

---

## Fase 4: Barcode + Media

- [x] **4.1** BarcodeModule: wiring completo + rate limiting 30 req/min
- [x] **4.2** MediaModule: wiring completo + endpoint presigned URL + bucket privado

**CHECKPOINT 4** — scan barcode → autocompleta producto; upload imagen → URL accesible

---

## Fase 5: Calidad y Producción

- [x] **5.1** Unit tests Jest — BarcodeService, MediaService, AuthService, ProductsService (23 tests, 100% pass)
- [x] **5.2** Rate limiting global (@nestjs/throttler) + logging estructurado pino (nestjs-pino)
- [x] **5.3** Docker Compose (Postgres + pgAdmin) + Dockerfile multi-stage + seed

**CHECKPOINT FINAL** — build, tests, e2e, Docker, review

---

## Decisiones (resueltas)

- [x] Refresh tokens → **tabla `refresh_tokens` en Postgres** (hash SHA-256, rotación en cada uso)
- [x] Delete strategy → **soft delete** en `supermarkets` + `shopping_lists` via `deleted_at`; hard delete en `products`
- [x] Moneda → **campo `currency CHAR(3)`** en `shopping_lists` (ISO 4217, default `MXN`)

## Fase 6: E2E, Producción y Decisiones

- [x] **6.1** E2E tests — flujo completo con supertest (register → login → CRUD → completar lista) — 24/24 passing
- [x] **6.2** Producción — `.env.example` completo, Joi valida AWS vars como required en production
- [x] **6.3** Decisiones pendientes — push notifications (fuera de scope v1, modelo en v2) + macOS (misma API, sin cambios)

## Decisiones Resueltas (fase 6)

- [x] Push notifications: **fuera de scope v1** — el backend solo expone REST; el cliente maneja APNs/FCM. Si se necesita en v2, agregar tabla `device_tokens(userId, token, platform, createdAt)`.
- [x] macOS client: **misma API sin cambios** — URI versioning + JWT + cookie HttpOnly funciona en iOS/macOS nativamente.

---

## Completado (Sesión anterior)

- [x] Prisma schema — 6 modelos con indexes y cascades
- [x] OpenAPI spec YAML — todas las rutas documentadas
- [x] `BarcodeService` + `BarcodeController` (sin wiring de módulo)
- [x] `MediaService` + `MediaController` + `UploadMediaDto` (sin wiring de módulo)
- [x] `cors.config.ts` — acepta clientes nativos sin `Origin`
- [x] `main.ts` — Helmet, CORS, versionado URI, ValidationPipe global
- [x] `.env.example`
