import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, listId: string, dto: CreateProductDto) {
    await this.assertListOwner(userId, listId);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          listId,
          name: dto.name,
          barcode: dto.barcode ?? null,
          quantity: new Decimal(dto.quantity),
          unitPrice: new Decimal(dto.unitPrice),
          brand: dto.brand ?? null,
          imageUrl: dto.imageUrl ?? null,
          supermarketId: dto.supermarketId ?? null,
        },
        select: this.productSelect(),
      });

      await this.recalculateTotal(tx, listId);
      return product;
    });
  }

  async findAll(userId: string, listId: string, query: QueryProductDto) {
    await this.assertListOwner(userId, listId);

    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { listId },
        select: this.productSelect(),
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where: { listId } }),
    ]);

    return { data, total };
  }

  async update(userId: string, listId: string, id: string, dto: UpdateProductDto) {
    await this.assertListOwner(userId, listId);
    await this.assertProductInList(id, listId);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.quantity !== undefined ? { quantity: new Decimal(dto.quantity) } : {}),
          ...(dto.unitPrice !== undefined ? { unitPrice: new Decimal(dto.unitPrice) } : {}),
          ...(dto.checked !== undefined ? { checked: dto.checked } : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        },
        select: this.productSelect(),
      });

      // Recalculate only when price-affecting fields change
      if (dto.quantity !== undefined || dto.unitPrice !== undefined) {
        await this.recalculateTotal(tx, listId);
      }

      return product;
    });
  }

  async remove(userId: string, listId: string, id: string) {
    await this.assertListOwner(userId, listId);
    await this.assertProductInList(id, listId);

    return this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await this.recalculateTotal(tx, listId);
    });
  }

  private async recalculateTotal(
    tx: Prisma.TransactionClient,
    listId: string,
  ) {
    const products = await tx.product.findMany({
      where: { listId },
      select: { quantity: true, unitPrice: true },
    });

    const totalAmount = products.reduce(
      (sum, p) => sum.add(p.quantity.mul(p.unitPrice)),
      new Decimal(0),
    );

    await tx.shoppingList.update({
      where: { id: listId },
      data: { totalAmount },
    });
  }

  private async assertListOwner(userId: string, listId: string) {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id: listId, deletedAt: null },
      select: { userId: true },
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.userId !== userId) throw new ForbiddenException();
  }

  private async assertProductInList(id: string, listId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, listId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found in this list');
  }

  private productSelect() {
    return {
      id: true,
      name: true,
      barcode: true,
      quantity: true,
      unitPrice: true,
      brand: true,
      imageUrl: true,
      checked: true,
      supermarketId: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
