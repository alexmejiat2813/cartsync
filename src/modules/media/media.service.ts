import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export interface UploadResult {
  id: string;
  publicUrl: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: this.config.getOrThrow('AWS_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = this.config.getOrThrow('AWS_S3_BUCKET');
    this.cdnBase = this.config.getOrThrow('CDN_BASE_URL');
  }

  async upload(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    userId: string,
  ): Promise<UploadResult> {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const key = `${dto.entityType}/${userId}/${randomUUID()}${ext}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata: {
            uploadedBy: userId,
            entityType: dto.entityType,
            ...(dto.entityId ? { entityId: dto.entityId } : {}),
          },
        }),
      );
    } catch (err) {
      this.logger.error('S3 upload failed', err);
      throw new InternalServerErrorException('File upload failed');
    }

    const publicUrl = `${this.cdnBase}/${key}`;

    const record = await this.prisma.mediaUpload.create({
      data: {
        userId,
        entityType: dto.entityType,
        entityId: dto.entityId ?? null,
        storageKey: key,
        publicUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    return {
      id: record.id,
      publicUrl: record.publicUrl,
      storageKey: record.storageKey,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }
}
