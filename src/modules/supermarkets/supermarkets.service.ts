import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupermarketDto } from './dto/create-supermarket.dto';
import { UpdateSupermarketDto } from './dto/update-supermarket.dto';
import { QuerySupermarketDto } from './dto/query-supermarket.dto';

@Injectable()
export class SupermarketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSupermarketDto) {
    return this.prisma.supermarket.create({
      data: { userId, name: dto.name, address: dto.address ?? null },
      select: this.select(),
    });
  }

  async findAll(userId: string, query: QuerySupermarketDto) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supermarket.findMany({
        where,
        select: this.select(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supermarket.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const supermarket = await this.prisma.supermarket.findFirst({
      where: { id, deletedAt: null },
      select: { ...this.select(), userId: true },
    });

    if (!supermarket) throw new NotFoundException('Supermarket not found');
    if (supermarket.userId !== userId) throw new ForbiddenException();

    const { userId: _, ...result } = supermarket;
    return result;
  }

  async update(userId: string, id: string, dto: UpdateSupermarketDto) {
    await this.assertOwner(userId, id);

    return this.prisma.supermarket.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
      select: this.select(),
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);

    await this.prisma.supermarket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertOwner(userId: string, id: string) {
    const supermarket = await this.prisma.supermarket.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });

    if (!supermarket) throw new NotFoundException('Supermarket not found');
    if (supermarket.userId !== userId) throw new ForbiddenException();
  }

  private select() {
    return {
      id: true,
      name: true,
      address: true,
      logoUrl: true,
      createdAt: true,
    };
  }
}
