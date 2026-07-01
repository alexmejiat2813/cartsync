import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum EntityType {
  PRODUCT = 'product',
  RECEIPT = 'receipt',
  SUPERMARKET = 'supermarket',
}

export class UploadMediaDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}
