## Approach

- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes in code or commits.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Session Startup (SIEMPRE al iniciar sesión)

1. Leer `tasks/todo.md`
2. Identificar próximo ítem pendiente `[ ]`
3. Marcar como `[~]` **antes** de empezar
4. Al completar, marcar `[x]` y hacer commit

No iniciar trabajo sin leer `tasks/todo.md` primero.

## Stack

- **Runtime**: Node.js 20 + NestJS 10 + TypeScript 5
- **ORM**: Prisma 5 + PostgreSQL 16
- **Auth**: Passport JWT (access 15m) + refresh token en cookie HttpOnly (7d, tabla `refresh_tokens`)
- **Storage**: AWS S3 + presigned URLs (bucket privado)
- **Docs**: OpenAPI via `@nestjs/swagger` — accesible en `/docs`
- **Tests**: Jest + `@nestjs/testing`

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main.ts` | Bootstrap — Helmet, CORS, cookie-parser, Swagger, ValidationPipe global |
| `src/app.module.ts` | Root module — registra ConfigModule, ThrottlerModule, PrismaModule, features |
| `src/config/env.validation.ts` | Joi schema — app no arranca si faltan vars críticas |
| `src/config/cors.config.ts` | CORS — permite clientes nativos sin `Origin` header |
| `src/prisma/prisma.service.ts` | PrismaClient singleton — connect/disconnect en lifecycle hooks |
| `prisma/schema.prisma` | Source of truth del modelo de datos — 7 modelos |
| `src/common/guards/jwt-auth.guard.ts` | Guard JWT reutilizable — aplica en cualquier controller |
| `src/common/decorators/current-user.decorator.ts` | Extrae `userId` del JWT payload |
| `src/common/filters/http-exception.filter.ts` | Formato uniforme de errores JSON |
| `src/common/interceptors/pagination.interceptor.ts` | Wrappea `{ data[], total }` en `{ data, meta }` |
| `src/modules/auth/` | Registro, login, refresh, logout, perfil |
| `tasks/todo.md` | Tracking de tareas — leer y actualizar cada sesión |
| `tasks/plan.md` | Plan completo con AC y fases |
| `openapi.yaml` | Spec OpenAPI 3.1 — mantener sincronizada con cambios de API |

## Convenciones

- **Commits**: en inglés, prefijos `feat:`, `fix:`, `refactor:`, `chore:`, `test:`. Scope entre paréntesis: `feat(auth):`, `fix(products):`
- **Módulos**: un directorio por dominio en `src/modules/{domain}/` con `controller`, `service`, `module`, `dto/`
- **DTOs**: validados con `class-validator`. `whitelist: true` en ValidationPipe elimina campos no declarados.
- **Ownership**: todo recurso tiene `userId`. Validar que el recurso pertenece al usuario autenticado antes de mutar — lanzar `ForbiddenException` (403), nunca 404, para no filtrar existencia.
- **Soft delete**: `supermarkets` y `shopping_lists` usan `deletedAt`. Filtrar `WHERE deleted_at IS NULL` en todas las queries de listado.
- **Paginación**: services devuelven `{ data: T[], total: number }`. El `PaginationInterceptor` global convierte a `{ data, meta }` automáticamente.
- **Moneda**: `currency CHAR(3)` ISO 4217 en `shopping_lists`, default `MXN`. Productos heredan moneda de su lista.
- **Decimales**: `unitPrice` y `totalAmount` como `Decimal` en Prisma — serializar a string en response, nunca float.
- **No agregar dependencias** sin necesidad real — verificar si NestJS o Node built-ins ya lo resuelven.

## Módulos pendientes (orden de implementación)

```
SupermarketsModule  → ListsModule → ProductsModule → BarcodeModule → MediaModule
```
