import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface PaginatedPayload<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RawPaginatedResult<T> {
  data: T[];
  total: number;
}

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));

    return next.handle().pipe(
      map((value) => {
        if (this.isPaginatedResult(value)) {
          return {
            data: value.data,
            meta: {
              total: value.total,
              page,
              limit,
              totalPages: Math.ceil(value.total / limit),
            },
          } satisfies PaginatedPayload<unknown>;
        }
        return value;
      }),
    );
  }

  private isPaginatedResult(value: unknown): value is RawPaginatedResult<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'total' in value &&
      Array.isArray((value as any).data)
    );
  }
}
