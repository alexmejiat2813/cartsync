import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupermarketDto {
  @ApiProperty({ example: 'Walmart Insurgentes' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Av. Insurgentes Sur 1234, CDMX' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
