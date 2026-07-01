import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Refresh token (native clients — web uses HttpOnly cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Device info for audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}
