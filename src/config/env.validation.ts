import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Required in production; optional in development (media upload will fail gracefully)
  AWS_REGION: Joi.string().allow('').when('NODE_ENV', { is: 'production', then: Joi.string().required(), otherwise: Joi.string().allow('').default('us-east-1') }),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').when('NODE_ENV', { is: 'production', then: Joi.string().required(), otherwise: Joi.string().allow('').default('dev') }),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').when('NODE_ENV', { is: 'production', then: Joi.string().required(), otherwise: Joi.string().allow('').default('dev') }),
  AWS_S3_BUCKET: Joi.string().allow('').when('NODE_ENV', { is: 'production', then: Joi.string().required(), otherwise: Joi.string().allow('').default('dev-bucket') }),
  CDN_BASE_URL: Joi.string().allow('').when('NODE_ENV', { is: 'production', then: Joi.string().uri().required(), otherwise: Joi.string().allow('').default('http://localhost:3000') }),

  CORS_ORIGINS: Joi.string().default(''),
});
