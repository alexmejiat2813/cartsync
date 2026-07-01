# Implementation Plan: CartSync API

## Overview

API RESTful para gestión de listas de mercado. Consumidores: Android, Web (fase 1), macOS nativa (fase 2). Stack: NestJS + TypeScript + Prisma + PostgreSQL + S3.

El boilerplate inicial cubre: schema Prisma, barcode controller/service, media controller/service, CORS config, main.ts, y spec OpenAPI. Faltan todos los módulos de negocio, auth, y la infraestructura de soporte (guards, interceptors, pipes, error filters).

## Architecture Decisions

- **NestJS modules** por dominio: cada feature es un módulo independiente con controller/service/dto propios.
- **Prisma** como ORM — type-safe, migraciones SQL versionadas, no ActiveRecord.
- **JWT stateless** — access token 15min + refresh token 7d en cookie HttpOnly.
- **Paginación** centralizada via `PaginationInterceptor` global — no duplicar lógica en cada service.
- **Ownership guard** reutilizable — `userId` extraído del JWT valida que el recurso pertenece al usuario antes de cualquier mutación.
- **S3 presigned URLs** para lectura (no exponer bucket público); `media_uploads` es el registro auditable.
- **Decimal como string** en responses (no float) para evitar errores de precisión monetaria.

## Dependency Graph

```
prisma/schema.prisma (migrations)
        │
        ├── PrismaService (módulo global)
        │       │
        │       ├── AuthModule (User CRUD + JWT)
        │       │       │
        │       │       └── JwtAuthGuard + CurrentUser decorator
        │       │               │
        │       │               ├── SupermarketsModule
        │       │               ├── ListsModule
        │       │               │       └── ProductsModule (nested bajo lists)
        │       │               ├── BarcodeModule  ← ya existe service/controller
        │       │               └── MediaModule    ← ya existe service/controller
        │       │
        │       └── PaginationInterceptor (global)
        │
        └── ConfigModule (global, .env validado con Joi)
```

## Fases y Tareas

---

### Fase 0: Infraestructura Base

#### Task 0.1: Inicializar proyecto NestJS y dependencias

**Descripción:** Crear el proyecto NestJS con todas las dependencias necesarias. Sin esto nada compila.

**Acceptance criteria:**
- [ ] `npm run build` exits 0
- [ ] `npm run start:dev` levanta en puerto 3000
- [ ] `GET /docs` devuelve Swagger UI

**Verificación:**
- [ ] `npm run build` sin errores
- [ ] `curl http://localhost:3000/docs-json` devuelve JSON válido

**Dependencias:** Ninguna

**Archivos:**
- `package.json`
- `tsconfig.json`
- `nest-cli.json`
- `src/app.module.ts`

**Scope:** S

---

#### Task 0.2: ConfigModule global + validación de env vars

**Descripción:** Registrar `@nestjs/config` con validación Joi para que la app falle rápido si faltan vars críticas (`DATABASE_URL`, `JWT_SECRET`, `AWS_*`).

**Acceptance criteria:**
- [ ] App no arranca si falta `DATABASE_URL`
- [ ] App no arranca si falta `JWT_SECRET`
- [ ] `ConfigService.getOrThrow()` disponible en todos los módulos

**Verificación:**
- [ ] Remover `DATABASE_URL` de `.env` → app lanza error descriptivo al iniciar
- [ ] Restaurar y app arranca normalmente

**Dependencias:** Task 0.1

**Archivos:**
- `src/config/env.validation.ts`
- `src/app.module.ts` (añadir ConfigModule)

**Scope:** S

---

#### Task 0.3: PrismaService + migraciones iniciales

**Descripción:** Módulo global de Prisma con `onModuleInit` / `enableShutdownHooks`. Ejecutar `prisma migrate dev` para crear las 6 tablas del schema ya definido.

**Acceptance criteria:**
- [ ] `prisma migrate dev` genera SQL sin errores
- [ ] `prisma studio` muestra las 6 tablas
- [ ] `PrismaService` inyectable en cualquier módulo

**Verificación:**
- [ ] `npx prisma migrate dev --name init` exits 0
- [ ] `npx prisma db pull` no reporta drift

**Dependencias:** Task 0.2

**Archivos:**
- `src/prisma/prisma.service.ts`
- `src/prisma/prisma.module.ts`
- `prisma/migrations/` (generado)

**Scope:** S

---

#### Task 0.4: Infraestructura compartida (guards, decorators, filters, interceptors)

**Descripción:** Piezas reutilizables que todos los módulos de negocio necesitan: `JwtAuthGuard`, `CurrentUser` decorator, `HttpExceptionFilter` (formato de error uniforme), `PaginationInterceptor`, `OwnershipGuard` base.

**Acceptance criteria:**
- [ ] `@CurrentUser()` extrae `userId` del JWT payload
- [ ] `HttpExceptionFilter` devuelve `{ statusCode, message, error, timestamp }` en todos los errores
- [ ] `PaginationInterceptor` wrappea arrays en `{ data, meta: { total, page, limit, totalPages } }`

**Verificación:**
- [ ] `GET /nonexistent` devuelve JSON con `statusCode: 404` (no HTML de Express)
- [ ] Unit test de `PaginationInterceptor` con array mock

**Dependencias:** Task 0.1

**Archivos:**
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/decorators/current-user.decorator.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/interceptors/pagination.interceptor.ts`

**Scope:** M

---

### Checkpoint: Fase 0

- [ ] `npm run build` exits 0
- [ ] App levanta, Swagger UI accesible en `/docs`
- [ ] Base de datos con 6 tablas creadas via migración
- [ ] Error responses tienen formato uniforme JSON
- [ ] **Revisar con humano antes de continuar**

---

### Fase 1: Auth (vertical slice completo)

#### Task 1.1: AuthModule — registro y login

**Descripción:** Endpoints `POST /v1/auth/register` y `POST /v1/auth/login`. Hash de password con bcrypt (rounds=12). JWT de acceso (15min) + refresh token (7d) en cookie HttpOnly Secure SameSite=Strict.

**Acceptance criteria:**
- [ ] `POST /auth/register` con email duplicado → 409
- [ ] `POST /auth/login` con credenciales incorrectas → 401
- [ ] Login exitoso → `{ accessToken, expiresIn, user }` + cookie `refresh_token`
- [ ] Access token contiene `{ sub: userId, email }`
- [ ] Password nunca aparece en logs ni en response

**Verificación:**
- [ ] `curl -X POST /auth/register` con body válido → 201
- [ ] `curl -X POST /auth/login` → JWT decodificable con `jwt.io`
- [ ] `curl -X GET /auth/me` sin token → 401
- [ ] `curl -X GET /auth/me` con token → 200

**Dependencias:** Task 0.3, Task 0.4

**Archivos:**
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/modules/auth/dto/register.dto.ts`
- `src/modules/auth/dto/login.dto.ts`

**Scope:** M

---

#### Task 1.2: Refresh token + logout

**Descripción:** `POST /auth/refresh` lee cookie `refresh_token`, valida en BD (tabla `refresh_tokens` o campo en `users`), emite nuevo access token. `POST /auth/logout` invalida el refresh token.

**Acceptance criteria:**
- [ ] Refresh token rotado en cada uso (old invalidado)
- [ ] Logout invalida el token — petición posterior con mismo token → 401
- [ ] Refresh token expirado → 401 (no 500)

**Verificación:**
- [ ] Test de flujo: login → refresh → logout → refresh → 401

**Dependencias:** Task 1.1

**Archivos:**
- `src/modules/auth/auth.controller.ts` (añadir endpoints)
- `src/modules/auth/auth.service.ts` (añadir lógica refresh)
- `prisma/migrations/` (añadir tabla `refresh_tokens` si se elige esa estrategia)

**Scope:** M

---

### Checkpoint: Fase 1

- [ ] Registro → login → acceso a ruta protegida flujo end-to-end funciona
- [ ] Refresh y logout funcionan
- [ ] JWT inválido/expirado → 401 con mensaje claro
- [ ] **Revisar con humano antes de continuar**

---

### Fase 2: Supermercados (primer CRUD completo)

#### Task 2.1: SupermarketsModule CRUD + paginación

**Descripción:** CRUD completo de supermercados. Usuarios solo ven/modifican sus propios supermercados (ownership via `userId` del JWT). Búsqueda por nombre (`?search=`). Paginación via interceptor global.

**Acceptance criteria:**
- [ ] `GET /supermarkets?search=walmart` filtra por nombre (case-insensitive)
- [ ] `GET /supermarkets` de otro usuario no devuelve mis supermercados
- [ ] `PATCH /supermarkets/:id` de supermercado ajeno → 403
- [ ] `DELETE /supermarkets/:id` con listas asociadas → comportamiento definido (soft-delete o cascade según decisión)
- [ ] Response paginada: `{ data, meta }`

**Verificación:**
- [ ] Crear 25 supermercados → `GET /supermarkets?limit=10&page=2` devuelve 10 items, `meta.total=25`
- [ ] Intento de acceso cross-user → 403

**Dependencias:** Task 1.1, Task 0.4

**Archivos:**
- `src/modules/supermarkets/supermarkets.module.ts`
- `src/modules/supermarkets/supermarkets.controller.ts`
- `src/modules/supermarkets/supermarkets.service.ts`
- `src/modules/supermarkets/dto/create-supermarket.dto.ts`
- `src/modules/supermarkets/dto/update-supermarket.dto.ts`

**Scope:** M

---

### Fase 3: Listas y Productos (núcleo del negocio)

#### Task 3.1: ListsModule CRUD

**Descripción:** CRUD de listas de compras. Filtrado por `status` y `supermarketId`. Al actualizar `status` a `COMPLETED`, calcular y persistir `total_amount` como suma de `quantity * unit_price` de todos los productos.

**Acceptance criteria:**
- [ ] `GET /lists?status=ACTIVE` filtra correctamente
- [ ] `GET /lists?supermarketId=:id` filtra por supermercado
- [ ] `PATCH /lists/:id` con `status: COMPLETED` → `total_amount` calculado automáticamente
- [ ] `GET /lists/:id` incluye supermercado anidado y array de productos

**Verificación:**
- [ ] Crear lista con 3 productos → completar → `total_amount` correcto
- [ ] `GET /lists/:id` devuelve estructura completa del spec

**Dependencias:** Task 2.1

**Archivos:**
- `src/modules/lists/lists.module.ts`
- `src/modules/lists/lists.controller.ts`
- `src/modules/lists/lists.service.ts`
- `src/modules/lists/dto/`

**Scope:** M

---

#### Task 3.2: ProductsModule CRUD (nested bajo lists)

**Descripción:** CRUD de productos bajo `/lists/:listId/products`. Validar que `listId` pertenece al usuario autenticado. Al crear/actualizar/eliminar un producto, recalcular `total_amount` de la lista en la misma transacción Prisma.

**Acceptance criteria:**
- [ ] `POST /lists/:listId/products` con `listId` ajeno → 403
- [ ] `POST /lists/:listId/products` con `listId` inexistente → 404
- [ ] Crear producto → `shopping_lists.total_amount` se actualiza inmediatamente
- [ ] `checked: true` en producto no altera `total_amount`
- [ ] Eliminar producto → `total_amount` recalculado

**Verificación:**
- [ ] Transacción: añadir producto → verificar `total_amount` en lista en misma request
- [ ] `DELETE /lists/:listId/products/:id` → lista refleja nuevo total

**Dependencias:** Task 3.1

**Archivos:**
- `src/modules/products/products.module.ts`
- `src/modules/products/products.controller.ts`
- `src/modules/products/products.service.ts`
- `src/modules/products/dto/`

**Scope:** M

---

### Checkpoint: Fase 3

- [ ] Flujo completo: crear supermercado → crear lista → añadir productos → completar lista → total correcto
- [ ] Isolation entre usuarios verificada
- [ ] Paginación funciona en `/lists` y `/lists/:id/products`
- [ ] **Revisar con humano antes de continuar**

---

### Fase 4: Barcode + Media (completar módulos existentes)

#### Task 4.1: Completar BarcodeModule (wiring)

**Descripción:** El service y controller ya existen. Falta crear `barcode.module.ts`, registrar `HttpModule` de NestJS con timeout global, e integrar al `AppModule`. Añadir rate limiting al endpoint (máx 30 req/min por usuario) para no abusar de Open Food Facts.

**Acceptance criteria:**
- [ ] `GET /v1/barcode/scan/7501055300166` devuelve datos de Open Food Facts
- [ ] Segunda llamada con mismo código → `source: "cache"`
- [ ] Barcode inexistente → 404 limpio
- [ ] OFF caído → 503 (no 500 con stack trace)
- [ ] >30 req/min mismo usuario → 429

**Verificación:**
- [ ] Scan código real → respuesta con nombre del producto
- [ ] Mock OFF con `nock` → verificar cache hit en segundo request

**Dependencias:** Task 0.3, Task 1.1

**Archivos:**
- `src/modules/barcode/barcode.module.ts`
- `src/app.module.ts` (registrar BarcodeModule)

**Scope:** S

---

#### Task 4.2: Completar MediaModule (wiring + presigned URLs)

**Descripción:** El service y controller ya existen. Falta `media.module.ts` y añadir endpoint `GET /media/:id/url` que devuelve presigned URL de S3 (expiración 1h) para descarga segura. El bucket NO debe ser público.

**Acceptance criteria:**
- [ ] `POST /media/upload` con JPEG válido → 201 con `publicUrl`
- [ ] `POST /media/upload` con PDF → 400 (`Unsupported MIME type`)
- [ ] `POST /media/upload` con archivo >5MB → 413
- [ ] `GET /media/:id/url` → presigned URL válida 1h
- [ ] `GET /media/:id/url` de upload ajeno → 403

**Verificación:**
- [ ] Upload imagen real → URL accesible vía `curl`
- [ ] Presigned URL expira tras 3600s (verificar con AWS CLI)

**Dependencias:** Task 0.3, Task 1.1

**Archivos:**
- `src/modules/media/media.module.ts`
- `src/modules/media/media.controller.ts` (añadir endpoint presigned)
- `src/modules/media/media.service.ts` (añadir `getPresignedUrl`)
- `src/app.module.ts`

**Scope:** S

---

### Fase 5: Calidad y Producción

#### Task 5.1: Test suite — unit tests de servicios críticos

**Descripción:** Tests unitarios con Jest para `BarcodeService` (mock HTTP), `MediaService` (mock S3), `AuthService` (mock Prisma), y `ProductsService` (verificar recálculo de totales).

**Acceptance criteria:**
- [ ] Coverage >80% en los 4 servicios listados
- [ ] `npm test` exits 0
- [ ] Tests mockean dependencias externas (no llaman a S3/OFF real)

**Verificación:**
- [ ] `npm run test:cov` muestra >80% en archivos objetivo

**Dependencias:** Fase 1–4 completa

**Archivos:**
- `src/modules/barcode/barcode.service.spec.ts`
- `src/modules/media/media.service.spec.ts`
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/products/products.service.spec.ts`

**Scope:** M

---

#### Task 5.2: Rate limiting + Helmet + logging estructurado

**Descripción:** `@nestjs/throttler` global (100 req/min default, 30 req/min en barcode). Helmet ya está en `main.ts`. Añadir `pino` como logger (JSON estructurado, incluye `requestId` en cada log).

**Acceptance criteria:**
- [ ] >100 req/min en cualquier endpoint → 429
- [ ] Logs en formato JSON con `level`, `timestamp`, `requestId`, `method`, `path`, `statusCode`, `durationMs`
- [ ] `X-Powered-By: Express` header ausente (Helmet)

**Verificación:**
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/v1/supermarkets` × 101 → último es 429
- [ ] Logs parseables con `jq`

**Dependencias:** Task 0.1

**Archivos:**
- `src/main.ts` (throttler, pino)
- `src/app.module.ts` (ThrottlerModule)

**Scope:** S

---

#### Task 5.3: Docker Compose para desarrollo local

**Descripción:** `docker-compose.yml` con PostgreSQL 16 + pgAdmin. `Dockerfile` multi-stage para producción. Script de seed para datos de prueba.

**Acceptance criteria:**
- [ ] `docker-compose up -d` levanta Postgres accesible en `localhost:5432`
- [ ] `npm run seed` crea 1 usuario, 3 supermercados, 2 listas, 5 productos
- [ ] `docker build` produce imagen <200MB

**Verificación:**
- [ ] `docker-compose up -d && npm run start:dev` → app funcional con BD local

**Dependencias:** Task 0.3

**Archivos:**
- `docker-compose.yml`
- `Dockerfile`
- `prisma/seed.ts`

**Scope:** S

---

### Checkpoint Final

- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 con >80% coverage en servicios críticos
- [ ] Flujo end-to-end completo: registro → login → crear supermercado → crear lista → añadir producto via barcode scan → upload imagen → completar lista
- [ ] Rate limiting activo
- [ ] Logs estructurados en JSON
- [ ] Docker Compose funcional
- [ ] **Review final con humano**

---

## Risks and Mitigations

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Open Food Facts fuera de aire | Alto | Cache local 7d + fallback 503 limpio ya implementado |
| Drift del schema Prisma | Alto | `prisma migrate dev` en cada cambio de modelo, CI bloquea si hay drift |
| Exposición accidental de bucket S3 | Alto | Bucket privado + presigned URLs; nunca `ACL: public-read` |
| Race condition en `total_amount` | Medio | Calcular dentro de `prisma.$transaction([])` atómica |
| JWT secret hardcodeado en dev | Medio | Validación Joi falla si `JWT_SECRET` es el valor de ejemplo |
| Pérdida de contexto entre sesiones | Bajo | `tasks/todo.md` como fuente de verdad del estado |

## Open Questions

1. **Refresh tokens**: ¿tabla `refresh_tokens` en BD o estrategia Redis? (Redis más escalable pero añade dependencia)
2. **Soft delete**: ¿supermercados/listas se eliminan lógicamente (`deleted_at`) o físicamente? Afecta reportes históricos.
3. **Multi-tenancy fase 2**: ¿macOS comparte la misma API o tendrá endpoints específicos?
4. **Moneda**: ¿`unit_price` siempre en la misma moneda o necesitamos campo `currency`?
5. **Notificaciones**: ¿push notifications cuando lista se completa? (Fuera de scope actual pero afecta modelo)
