import { PartialType } from '@nestjs/swagger';
import { CreateSupermarketDto } from './create-supermarket.dto';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupermarketDto extends PartialType(CreateSupermarketDto) {
  @ApiPropertyOptional({ description: 'Public URL of supermarket logo' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
