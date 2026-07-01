import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { BarcodeService } from './barcode.service';
import { PrismaService } from '../../prisma/prisma.service';

const FRESH_DATE = new Date(); // within 7-day TTL
const STALE_DATE = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

const mockPrisma = {
  productCatalog: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockHttp = { get: jest.fn() };

const offResponse = (status: number, product?: object) => ({
  data: { status, product },
});

describe('BarcodeService', () => {
  let service: BarcodeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarcodeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    service = module.get<BarcodeService>(BarcodeService);
  });

  it('returns cached result when cache is fresh', async () => {
    const cached = {
      barcode: '123', name: 'Leche', brand: 'Lala',
      category: 'dairy', imageUrl: null, nutriscore: 'A', cachedAt: FRESH_DATE,
    };
    mockPrisma.productCatalog.findUnique.mockResolvedValue(cached);

    const result = await service.lookup('123', 'user-id');

    expect(result.source).toBe('cache');
    expect(mockHttp.get).not.toHaveBeenCalled();
  });

  it('fetches from OFF and upserts when cache is stale', async () => {
    const stale = { barcode: '123', name: 'Old', brand: null, category: null, imageUrl: null, nutriscore: null, cachedAt: STALE_DATE };
    mockPrisma.productCatalog.findUnique.mockResolvedValue(stale);

    const product = {
      product_name: 'Leche Lala',
      brands: 'Lala',
      categories_tags: ['en:dairy'],
      nutriscore_grade: 'a',
      image_front_url: 'https://img.example.com/leche.jpg',
    };
    mockHttp.get.mockReturnValue(of(offResponse(1, product)));

    const upserted = { barcode: '123', name: 'Leche Lala', brand: 'Lala', category: 'dairy', imageUrl: null, nutriscore: 'A', cachedAt: new Date() };
    mockPrisma.productCatalog.upsert.mockResolvedValue(upserted);

    const result = await service.lookup('123', 'user-id');

    expect(result.source).toBe('openfoodfacts');
    expect(mockPrisma.productCatalog.upsert).toHaveBeenCalled();
  });

  it('fetches from OFF when no cache exists', async () => {
    mockPrisma.productCatalog.findUnique.mockResolvedValue(null);

    const product = {
      product_name: 'Test Product',
      brands: 'Brand',
      categories_tags: ['en:snacks'],
      nutriscore_grade: 'b',
      image_front_url: null,
    };
    mockHttp.get.mockReturnValue(of(offResponse(1, product)));
    mockPrisma.productCatalog.upsert.mockResolvedValue({
      barcode: '456', name: 'Test Product', brand: 'Brand',
      category: 'snacks', imageUrl: null, nutriscore: 'B', cachedAt: new Date(),
    });

    const result = await service.lookup('456', 'user-id');
    expect(result.name).toBe('Test Product');
  });

  it('throws NotFoundException when OFF returns status 0', async () => {
    mockPrisma.productCatalog.findUnique.mockResolvedValue(null);
    mockHttp.get.mockReturnValue(of(offResponse(0)));

    await expect(service.lookup('unknown', 'user-id')).rejects.toThrow(NotFoundException);
  });

  it('throws InternalServerErrorException when OFF network fails', async () => {
    mockPrisma.productCatalog.findUnique.mockResolvedValue(null);
    mockHttp.get.mockReturnValue(throwError(() => new Error('Network error')));

    await expect(service.lookup('789', 'user-id')).rejects.toThrow(InternalServerErrorException);
  });
});
