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

- [ ] **3.1** ListsModule: CRUD + filtros por status/supermarket + cálculo de total al completar
- [ ] **3.2** ProductsModule: CRUD nested bajo `/lists/:listId/products` + recálculo de total en transacción

**CHECKPOINT 3** — flujo crear lista → añadir productos → completar → total correcto

---

## Fase 4: Barcode + Media

- [ ] **4.1** BarcodeModule: wiring completo + rate limiting 30 req/min
- [ ] **4.2** MediaModule: wiring completo + endpoint presigned URL + bucket privado

**CHECKPOINT 4** — scan barcode → autocompleta producto; upload imagen → URL accesible

---

## Fase 5: Calidad y Producción

- [ ] **5.1** Unit tests Jest — BarcodeService, MediaService, AuthService, ProductsService (>80% cov)
- [ ] **5.2** Rate limiting global (@nestjs/throttler) + logging estructurado pino
- [ ] **5.3** Docker Compose (Postgres + pgAdmin) + Dockerfile multi-stage + seed

**CHECKPOINT FINAL** — build, tests, e2e, Docker, review

---

## Decisiones (resueltas)

- [x] Refresh tokens → **tabla `refresh_tokens` en Postgres** (hash SHA-256, rotación en cada uso)
- [x] Delete strategy → **soft delete** en `supermarkets` + `shopping_lists` via `deleted_at`; hard delete en `products`
- [x] Moneda → **campo `currency CHAR(3)`** en `shopping_lists` (ISO 4217, default `MXN`)

## Decisiones Pendientes

- [ ] Push notifications: fuera de scope o planificar modelo ahora
- [ ] macOS (fase 2): misma API o endpoints adicionales

---

## Completado (Sesión anterior)

- [x] Prisma schema — 6 modelos con indexes y cascades
- [x] OpenAPI spec YAML — todas las rutas documentadas
- [x] `BarcodeService` + `BarcodeController` (sin wiring de módulo)
- [x] `MediaService` + `MediaController` + `UploadMediaDto` (sin wiring de módulo)
- [x] `cors.config.ts` — acepta clientes nativos sin `Origin`
- [x] `main.ts` — Helmet, CORS, versionado URI, ValidationPipe global
- [x] `.env.example`
