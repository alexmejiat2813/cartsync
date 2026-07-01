import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { QueryListDto } from './dto/query-list.dto';
import { ListStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateListDto) {
    if (dto.supermarketId) {
      await this.assertSupermarketOwner(userId, dto.supermarketId);
    }

    return this.prisma.shoppingList.create({
      data: {
        userId,
        name: dto.name,
        currency: dto.currency ?? 'MXN',
        supermarketId: dto.supermarketId ?? null,
      },
      select: this.listSelect(),
    });
  }

  async findAll(userId: string, query: QueryListDto) {
    const { status, supermarketId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(supermarketId ? { supermarketId } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.shoppingList.findMany({
        where,
        select: this.listSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shoppingList.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...this.listSelect(),
        userId: true,
        supermarket: {
          select: { id: true, name: true, address: true, logoUrl: true },
        },
        products: {
          select: {
            id: true,
            name: true,
            barcode: true,
            quantity: true,
            unitPrice: true,
            brand: true,
            imageUrl: true,
            checked: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!list) throw new NotFoundException('List not found');
    if (list.userId !== userId) throw new ForbiddenException();

    const { userId: _, ...result } = list;
    return result;
  }

  async update(userId: string, id: string, dto: UpdateListDto) {
    await this.assertOwner(userId, id);

    if (dto.supermarketId !== undefined && dto.supermarketId !== null) {
      await this.assertSupermarketOwner(userId, dto.supermarketId);
    }

    const isCompleting = dto.status === ListStatus.COMPLETED;

    // Calculate total inside transaction when completing
    return this.prisma.$transaction(async (tx) => {
      let totalAmount: Decimal | undefined;

      if (isCompleting) {
        const products = await tx.product.findMany({
          where: { listId: id },
          select: { quantity: true, unitPrice: true },
        });

        totalAmount = products.reduce(
          (sum, p) => sum.add(p.quantity.mul(p.unitPrice)),
          new Decimal(0),
        );
      }

      return tx.shoppingList.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.supermarketId !== undefined ? { supermarketId: dto.supermarketId } : {}),
          ...(dto.purchasedAt !== undefined ? { purchasedAt: new Date(dto.purchasedAt) } : {}),
          ...(isCompleting && totalAmount !== undefined ? { totalAmount } : {}),
        },
        select: this.listSelect(),
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.shoppingList.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertOwner(userId: string, id: string) {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.userId !== userId) throw new ForbiddenException();
  }

  private async assertSupermarketOwner(userId: string, supermarketId: string) {
    const supermarket = await this.prisma.supermarket.findFirst({
      where: { id: supermarketId, deletedAt: null },
      select: { userId: true },
    });
    if (!supermarket) throw new NotFoundException('Supermarket not found');
    if (supermarket.userId !== userId) throw new ForbiddenException();
  }

  private listSelect() {
    return {
      id: true,
      name: true,
      status: true,
      currency: true,
      totalAmount: true,
      receiptUrl: true,
      supermarketId: true,
      purchasedAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
