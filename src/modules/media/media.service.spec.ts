import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityType } from './dto/upload-media.dto';

// Mock entire AWS SDK modules
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockPrisma = {
  mediaUpload: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_S3_BUCKET: 'test-bucket',
      CDN_BASE_URL: 'https://cdn.example.com',
    };
    return map[key] ?? '';
  }),
};

const mockFile: Express.Multer.File = {
  fieldname: 'file',
  originalname: 'photo.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('fake-image'),
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
};

describe('MediaService', () => {
  let service: MediaService;
  let s3Send: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    s3Send = (S3Client as jest.Mock).mock.results[0]?.value.send ?? jest.fn();
    (service as any).s3 = { send: s3Send };
  });

  describe('upload', () => {
    it('uploads to S3 and records in DB', async () => {
      s3Send.mockResolvedValue({});
      mockPrisma.mediaUpload.create.mockResolvedValue({
        id: 'media-id',
        publicUrl: 'https://cdn.example.com/product/user-id/uuid.jpg',
        storageKey: 'product/user-id/uuid.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(1024),
      });

      const result = await service.upload(
        mockFile,
        { entityType: EntityType.PRODUCT },
        'user-id',
      );

      expect(s3Send).toHaveBeenCalled();
      expect(mockPrisma.mediaUpload.create).toHaveBeenCalled();
      expect(result.id).toBe('media-id');
    });

    it('throws InternalServerErrorException when S3 send fails', async () => {
      s3Send.mockRejectedValue(new Error('S3 error'));

      await expect(
        service.upload(mockFile, { entityType: EntityType.PRODUCT }, 'user-id'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockPrisma.mediaUpload.create).not.toHaveBeenCalled();
    });
  });

  describe('getPresignedUrl', () => {
    it('returns presigned URL for owner', async () => {
      mockPrisma.mediaUpload.findUnique.mockResolvedValue({
        userId: 'user-id',
        storageKey: 'product/user-id/uuid.jpg',
      });
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.presigned.url');

      const result = await service.getPresignedUrl('media-id', 'user-id');

      expect(result.url).toBe('https://s3.presigned.url');
      expect(result.expiresIn).toBe(3600);
    });

    it('throws NotFoundException when media does not exist', async () => {
      mockPrisma.mediaUpload.findUnique.mockResolvedValue(null);
      await expect(service.getPresignedUrl('bad-id', 'user-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.mediaUpload.findUnique.mockResolvedValue({
        userId: 'other-user',
        storageKey: 'product/other/uuid.jpg',
      });
      await expect(service.getPresignedUrl('media-id', 'user-id')).rejects.toThrow(ForbiddenException);
    });
  });
});
