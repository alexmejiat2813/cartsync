import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

interface OpenFoodFactsProduct {
  product_name: string;
  brands: string;
  categories_tags: string[];
  nutriscore_grade: string;
  image_front_url: string;
}

interface OpenFoodFactsResponse {
  status: number; // 0 = not found, 1 = found
  product: OpenFoodFactsProduct;
}

export interface BarcodeProductDto {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  nutriscore: string | null;
  source: 'cache' | 'openfoodfacts';
}

@Injectable()
export class BarcodeService {
  private readonly logger = new Logger(BarcodeService.name);
  private readonly OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
  // Cache TTL: 7 days in ms
  private readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async lookup(barcode: string, _userId: string): Promise<BarcodeProductDto> {
    const cached = await this.prisma.productCatalog.findUnique({
      where: { barcode },
    });

    if (cached && this.isFresh(cached.cachedAt)) {
      return this.mapCatalog(cached, 'cache');
    }

    const product = await this.fetchFromOFF(barcode);

    const upserted = await this.prisma.productCatalog.upsert({
      where: { barcode },
      create: {
        barcode,
        name: product.product_name ?? 'Unknown',
        brand: product.brands ?? null,
        category: product.categories_tags?.[0]?.replace('en:', '') ?? null,
        imageUrl: product.image_front_url ?? null,
        nutriscore: product.nutriscore_grade?.toUpperCase() ?? null,
        source: 'openfoodfacts',
        cachedAt: new Date(),
      },
      update: {
        name: product.product_name ?? 'Unknown',
        brand: product.brands ?? null,
        category: product.categories_tags?.[0]?.replace('en:', '') ?? null,
        imageUrl: product.image_front_url ?? null,
        nutriscore: product.nutriscore_grade?.toUpperCase() ?? null,
        cachedAt: new Date(),
      },
    });

    return this.mapCatalog(upserted, 'openfoodfacts');
  }

  private async fetchFromOFF(barcode: string): Promise<OpenFoodFactsProduct> {
    try {
      const url = `${this.OFF_BASE}/${barcode}?fields=product_name,brands,categories_tags,nutriscore_grade,image_front_url`;
      const { data } = await firstValueFrom(
        this.http.get<OpenFoodFactsResponse>(url, {
          headers: { 'User-Agent': 'CartSync/1.0 (alexmejia.1305@gmail.com)' },
          timeout: 5000,
        }),
      );

      if (data.status === 0 || !data.product) {
        throw new NotFoundException(`Barcode ${barcode} not found in Open Food Facts`);
      }

      return data.product;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`OFF lookup failed for ${barcode}`, err);
      throw new InternalServerErrorException('External barcode service unavailable');
    }
  }

  private isFresh(cachedAt: Date): boolean {
    return Date.now() - cachedAt.getTime() < this.CACHE_TTL_MS;
  }

  private mapCatalog(catalog: any, source: 'cache' | 'openfoodfacts'): BarcodeProductDto {
    return {
      barcode: catalog.barcode,
      name: catalog.name,
      brand: catalog.brand,
      category: catalog.category,
      imageUrl: catalog.imageUrl,
      nutriscore: catalog.nutriscore,
      source,
    };
  }
}
