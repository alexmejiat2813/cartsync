import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow native clients (Android, macOS) that send no Origin header
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,
};
