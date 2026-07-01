import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const USER_ID = 'user-uuid';
const LIST_ID = 'list-uuid';
const PRODUCT_ID = 'product-uuid';

// Minimal tx mock — mirrors Prisma.TransactionClient shape used in service
const makeTx = (overrides: Partial<typeof mockPrisma> = {}) => ({
  ...mockPrisma,
  ...overrides,
});

const mockPrisma = {
  shoppingList: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: list belongs to USER_ID
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ userId: USER_ID });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('throws ForbiddenException when list belongs to another user', async () => {
      mockPrisma.shoppingList.findFirst.mockResolvedValue({ userId: 'other-user' });

      await expect(
        service.create(USER_ID, LIST_ID, { name: 'Leche', quantity: 1, unitPrice: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when list does not exist', async () => {
      mockPrisma.shoppingList.findFirst.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, LIST_ID, { name: 'Leche', quantity: 1, unitPrice: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates product and recalculates total inside transaction', async () => {
      const createdProduct = {
        id: PRODUCT_ID, name: 'Leche', quantity: new Decimal(2),
        unitPrice: new Decimal(25), brand: null, barcode: null,
        imageUrl: null, checked: false, supermarketId: null, createdAt: new Date(), updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = makeTx({
          product: {
            ...mockPrisma.product,
            create: jest.fn().mockResolvedValue(createdProduct),
            findMany: jest.fn().mockResolvedValue([
              { quantity: new Decimal(2), unitPrice: new Decimal(25) },
            ]),
          },
          shoppingList: {
            ...mockPrisma.shoppingList,
            update: jest.fn().mockResolvedValue({}),
          },
        });
        return fn(tx);
      });

      const result = await service.create(USER_ID, LIST_ID, { name: 'Leche', quantity: 2, unitPrice: 25 });

      expect(result.id).toBe(PRODUCT_ID);
      // $transaction was called (total recalculation happens inside)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('total recalculation', () => {
    it('calculates sum of quantity * unitPrice correctly', async () => {
      // Simulate 3 products: 2×25 + 1×10 + 3×5 = 75
      let capturedTotal: Decimal | undefined;

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = makeTx({
          product: {
            ...mockPrisma.product,
            create: jest.fn().mockResolvedValue({ id: 'p', name: 'X', quantity: new Decimal(2), unitPrice: new Decimal(25), brand: null, barcode: null, imageUrl: null, checked: false, supermarketId: null, createdAt: new Date(), updatedAt: new Date() }),
            findMany: jest.fn().mockResolvedValue([
              { quantity: new Decimal(2), unitPrice: new Decimal(25) },
              { quantity: new Decimal(1), unitPrice: new Decimal(10) },
              { quantity: new Decimal(3), unitPrice: new Decimal(5) },
            ]),
          },
          shoppingList: {
            ...mockPrisma.shoppingList,
            update: jest.fn().mockImplementation(({ data }: any) => {
              capturedTotal = data.totalAmount;
              return Promise.resolve({});
            }),
          },
        });
        return fn(tx);
      });

      await service.create(USER_ID, LIST_ID, { name: 'X', quantity: 2, unitPrice: 25 });

      expect(capturedTotal?.toNumber()).toBe(75);
    });
  });

  describe('update', () => {
    it('does not recalculate total when only checked changes', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID });

      const updateMock = jest.fn().mockResolvedValue({ id: PRODUCT_ID, checked: true });
      const listUpdateMock = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = makeTx({
          product: { ...mockPrisma.product, update: updateMock, findMany: jest.fn() },
          shoppingList: { ...mockPrisma.shoppingList, update: listUpdateMock },
        });
        return fn(tx);
      });

      await service.update(USER_ID, LIST_ID, PRODUCT_ID, { checked: true });

      // shoppingList.update should NOT be called (no price/qty change)
      expect(listUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes product and recalculates total', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID });

      const deleteMock = jest.fn().mockResolvedValue({});
      const listUpdateMock = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = makeTx({
          product: {
            ...mockPrisma.product,
            delete: deleteMock,
            findMany: jest.fn().mockResolvedValue([]),
          },
          shoppingList: { ...mockPrisma.shoppingList, update: listUpdateMock },
        });
        return fn(tx);
      });

      await service.remove(USER_ID, LIST_ID, PRODUCT_ID);

      expect(deleteMock).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
      expect(listUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalAmount: new Decimal(0) } }),
      );
    });
  });
});
