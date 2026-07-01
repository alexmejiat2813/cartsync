import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PaginationInterceptor } from '../src/common/interceptors/pagination.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CartSync API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshCookie: string;
  let otherAccessToken: string;

  const testEmail = `e2e-${Date.now()}@test.local`;
  const otherEmail = `e2e-other-${Date.now()}@test.local`;
  const testPassword = 'Test@1234';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);

    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new PaginationInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, otherEmail] } } });
    await app.close();
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /v1/auth/register → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: testEmail, password: testPassword, name: 'E2E User' })
        .expect(201);

      accessToken = res.body.accessToken;
      refreshCookie = res.headers['set-cookie']?.[0] ?? '';
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('POST /v1/auth/register duplicate → 409', () =>
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: testEmail, password: testPassword, name: 'Dup' })
        .expect(409));

    it('POST /v1/auth/login → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      accessToken = res.body.accessToken;
      refreshCookie = res.headers['set-cookie']?.[0] ?? '';
      expect(res.body).toHaveProperty('accessToken');
    });

    it('POST /v1/auth/login wrong password → 401', () =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: 'wrong' })
        .expect(401));

    it('GET /v1/auth/me → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.email).toBe(testEmail);
    });

    it('GET /v1/auth/me no token → 401', () =>
      request(app.getHttpServer()).get('/v1/auth/me').expect(401));

    it('POST /v1/auth/refresh → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      accessToken = res.body.accessToken;
      refreshCookie = res.headers['set-cookie']?.[0] ?? '';
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  // ─── Supermarkets ─────────────────────────────────────────────────────────

  let supermarketId: string;

  describe('Supermarkets', () => {
    it('POST /v1/supermarkets → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/supermarkets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Market', address: 'Calle Test 1' })
        .expect(201);

      supermarketId = res.body.id;
      expect(res.body.name).toBe('E2E Market');
    });

    it('GET /v1/supermarkets → 200 with pagination meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/supermarkets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('GET /v1/supermarkets/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/supermarkets/${supermarketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.id).toBe(supermarketId);
    });

    it('PATCH /v1/supermarkets/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/supermarkets/${supermarketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Market Updated' })
        .expect(200);
      expect(res.body.name).toBe('E2E Market Updated');
    });
  });

  // ─── Lists ────────────────────────────────────────────────────────────────

  let listId: string;

  describe('Lists', () => {
    it('POST /v1/lists → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/lists')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Lista', supermarketId, currency: 'MXN' })
        .expect(201);

      // Assign before assertions so subsequent tests always have the id
      listId = res.body.id;
      expect(res.body.name).toBe('E2E Lista');
      expect(['ACTIVE', 'DRAFT']).toContain(res.body.status);
    });

    it('GET /v1/lists → 200 with meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/lists')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /v1/lists/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/lists/${listId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.id).toBe(listId);
    });
  });

  // ─── Products ─────────────────────────────────────────────────────────────

  let productId: string;

  describe('Products', () => {
    it('POST /v1/lists/:listId/products → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/lists/${listId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Leche', quantity: 2, unitPrice: 25.50 })
        .expect(201);

      productId = res.body.id;
      expect(res.body.name).toBe('Leche');
      expect(Number(res.body.quantity)).toBe(2);
    });

    it('POST second product', async () => {
      await request(app.getHttpServer())
        .post(`/v1/lists/${listId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Pan', quantity: 1, unitPrice: 18.00 })
        .expect(201);
    });

    it('GET /v1/lists/:listId/products → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/lists/${listId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.meta.total).toBe(2);
    });

    it('PATCH product quantity → 200 and list total recalculates', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/lists/${listId}/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 3 })
        .expect(200);

      // 3*25.50 + 1*18.00 = 94.50
      const list = await request(app.getHttpServer())
        .get(`/v1/lists/${listId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(parseFloat(list.body.totalAmount)).toBeCloseTo(94.5, 1);
    });

    it('DELETE product → 204', () =>
      request(app.getHttpServer())
        .delete(`/v1/lists/${listId}/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204));
  });

  // ─── Complete list ─────────────────────────────────────────────────────────

  describe('Complete list flow', () => {
    it('PATCH list status=COMPLETED → 200 with totalAmount', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/lists/${listId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
      // Only Pan remains: 1*18.00 = 18.00
      expect(parseFloat(res.body.totalAmount)).toBeCloseTo(18.0, 1);
    });
  });

  // ─── Ownership isolation ──────────────────────────────────────────────────

  describe('Ownership', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: otherEmail, password: testPassword, name: 'Other' })
        .expect(201);
      otherAccessToken = res.body.accessToken;
    });

    it('GET other user list → 403', () =>
      request(app.getHttpServer())
        .get(`/v1/lists/${listId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(403));

    it('PATCH other user supermarket → 403', () =>
      request(app.getHttpServer())
        .patch(`/v1/supermarkets/${supermarketId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({ name: 'Hack' })
        .expect(403));
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  describe('Cleanup', () => {
    it('DELETE /v1/supermarkets/:id → 204', () =>
      request(app.getHttpServer())
        .delete(`/v1/supermarkets/${supermarketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204));

    it('POST /v1/auth/logout → 204', () =>
      request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', refreshCookie)
        .expect(204));
  });
});
