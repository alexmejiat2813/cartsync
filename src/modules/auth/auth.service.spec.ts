import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn().mockReturnValue('signed-token') };
const mockConfig = { get: jest.fn(), getOrThrow: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue('15m');
    mockConfig.getOrThrow.mockReturnValue('secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({ email: 'test@test.com', password: 'password123', name: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        email: 'test@test.com',
        name: 'Test',
        avatarUrl: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'token-id' });

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('test@test.com');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@test.com' }),
        }),
      );
    });

    it('stores email in lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'id', email: 'UPPER@TEST.COM', name: 'T', avatarUrl: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 't' });

      await service.register({ email: 'UPPER@TEST.COM', password: 'pass1234', name: 'T' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'upper@test.com' } }),
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'missing@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'id', email: 'u@test.com', name: 'U', avatarUrl: null,
        passwordHash: await bcrypt.hash('correct', 12),
        isActive: true,
      });

      await expect(
        service.login({ email: 'u@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('correct123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'id', email: 'u@test.com', name: 'U', avatarUrl: null,
        passwordHash: hash, isActive: true,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 't' });

      const result = await service.login({ email: 'u@test.com', password: 'correct123' });

      expect(result.accessToken).toBe('signed-token');
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('revokes matching token without throwing', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.logout('raw-token')).resolves.not.toThrow();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });
});
