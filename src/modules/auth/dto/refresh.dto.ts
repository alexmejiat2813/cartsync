import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Device info for audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}
