import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    const { accessToken, expiresIn } = this.issueAccessToken(user.id, user.email);
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, expiresIn, refreshToken, user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, name: true, avatarUrl: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, expiresIn } = this.issueAccessToken(user.id, user.email);
    const refreshToken = await this.issueRefreshToken(user.id);

    const { passwordHash: _, ...userWithoutPassword } = user;

    return { accessToken, expiresIn, refreshToken, user: userWithoutPassword };
  }

  async refresh(rawToken: string, deviceInfo?: string) {
    const tokenHash = this.hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, expiresIn } = this.issueAccessToken(stored.user.id, stored.user.email);
    const newRefreshToken = await this.issueRefreshToken(stored.user.id, deviceInfo);

    return { accessToken, expiresIn, refreshToken: newRefreshToken };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
  }

  private issueAccessToken(userId: string, email: string) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const accessToken = this.jwt.sign({ sub: userId, email }, { expiresIn });
    return { accessToken, expiresIn };
  }

  private async issueRefreshToken(userId: string, deviceInfo?: string): Promise<string> {
    const raw = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + this.parseExpiry(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    ));

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, deviceInfo: deviceInfo ?? null },
    });

    return raw;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseExpiry(str: string): number {
    const unit = str.slice(-1);
    const value = parseInt(str.slice(0, -1), 10);
    const units: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * (units[unit] ?? 86_400_000);
  }
}
