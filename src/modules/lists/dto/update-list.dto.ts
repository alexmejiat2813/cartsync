import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListStatus } from '@prisma/client';

export class UpdateListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ enum: ListStatus })
  @IsOptional()
  @IsEnum(ListStatus)
  status?: ListStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  supermarketId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
