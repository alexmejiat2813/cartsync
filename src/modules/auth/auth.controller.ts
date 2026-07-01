import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

const COOKIE_NAME = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/v1/auth',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User created, tokens issued' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    // Web: set HttpOnly cookie. Native: refreshToken also in body.
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result; // includes refreshToken for native clients
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Authenticate and receive JWT' })
  @ApiResponse({ status: 200, description: 'Tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result; // includes refreshToken for native clients
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token, issue new access token' })
  @ApiBody({ type: RefreshDto, required: false })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie takes precedence (web); fall back to body (native)
    const rawToken = (req.cookies?.[COOKIE_NAME] as string | undefined) ?? dto.refreshToken;
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const deviceInfo = dto.deviceInfo ?? req.headers['user-agent']?.slice(0, 255);
    const result = await this.authService.refresh(rawToken, deviceInfo);
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result; // includes refreshToken for native clients
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke refresh token' })
  @ApiBody({ type: RefreshDto, required: false })
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = (req.cookies?.[COOKIE_NAME] as string | undefined) ?? dto.refreshToken;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(COOKIE_NAME, { path: '/v1/auth' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  async me(@CurrentUser() userId: string) {
    return this.authService.getProfile(userId);
  }
}
