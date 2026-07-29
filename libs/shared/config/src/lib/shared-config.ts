import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']);

export const portSchema = z.coerce.number().int().min(1).max(65535);

export const nonEmptyStringSchema = z.string().trim().min(1);

export const serviceBaseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: portSchema.default(3000),
  SERVICE_NAME: nonEmptyStringSchema,
  DATABASE_URL: nonEmptyStringSchema,
  REDIS_URL: nonEmptyStringSchema.optional(),
  RABBITMQ_URL: nonEmptyStringSchema.optional(),
  JWT_ACCESS_SECRET: nonEmptyStringSchema.optional(),
  JWT_REFRESH_SECRET: nonEmptyStringSchema.optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type ServiceBaseEnv = z.infer<typeof serviceBaseEnvSchema>;

export class ConfigValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigValidationError(
      'Cấu hình môi trường không hợp lệ',
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export function loadServiceBaseEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServiceBaseEnv {
  return loadEnv(serviceBaseEnvSchema, source);
}
