import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SupermarketsModule } from './modules/supermarkets/supermarkets.module';
import { ListsModule } from './modules/lists/lists.module';
import { ProductsModule } from './modules/products/products.module';
import { BarcodeModule } from './modules/barcode/barcode.module';
import { MediaModule } from './modules/media/media.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        customProps: () => ({ context: 'HTTP' }),
        serializers: {
          req: (req) => ({ method: req.method, url: req.url, id: req.id }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    SupermarketsModule,
    ListsModule,
    ProductsModule,
    BarcodeModule,
    MediaModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: PaginationInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
