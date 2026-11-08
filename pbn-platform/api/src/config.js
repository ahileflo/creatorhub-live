/**
 * Configurația API-ului, validată la pornire cu zod.
 * O variabilă lipsă sau greșită oprește procesul imediat (fail fast),
 * în loc să producă erori greu de diagnosticat în timpul unei cereri.
 */
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  PUBLIC_API_URL: z.url().default('http://localhost:8080'),
  APP_URL: z.url().default('http://localhost:3000'), // frontend-ul (redirect după OAuth)

  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/pbn'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QUEUE_PREFIX: z.string().default('pbn'),

  // Autentificare: HS256 (dev) sau JWKS (Cognito/Auth0/Clerk în producție).
  AUTH_JWT_SECRET: z.string().min(32).optional(),
  AUTH_JWKS_URL: z.url().optional(),
  AUTH_ISSUER: z.string().optional(),
  AUTH_AUDIENCE: z.string().optional(),

  // Stocare
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  S3_BUCKET_SOURCES: z.string().default('pbn-dev-sources'),
  S3_BUCKET_ARTIFACTS: z.string().default('pbn-dev-artifacts'),
  S3_REGION: z.string().default('eu-central-1'),
  S3_ENDPOINT: z.url().optional(), // MinIO / GCS interoperability
  LOCAL_STORAGE_DIR: z.string().default('./.data/storage'),
  LOCAL_STORAGE_SECRET: z.string().min(32).default('dev-only-local-storage-signing-secret!!'),

  // Criptare
  KEY_PROVIDER: z.enum(['local', 'kms']).default('local'),
  LOCAL_MASTER_KEY: z.string().optional(), // 32 octeți base64 (doar dev)
  LOCAL_UPLOAD_PRIVATE_KEY_PEM: z.string().optional(), // RSA-3072 PKCS#8 (doar dev)
  KMS_TOKEN_KEY_ID: z.string().optional(), // cheie simetrică (envelope encryption)
  KMS_UPLOAD_KEY_ID: z.string().optional(), // cheie asimetrică RSA_3072, ENCRYPT_DECRYPT

  // Google
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // Stoc
  UNSPLASH_ACCESS_KEY: z.string().default(''),
  PEXELS_API_KEY: z.string().default(''),

  // Limite
  MAX_UPLOAD_BYTES: z.coerce.number().int().default(50 * 1024 * 1024),
  ENGINE_VERSION: z.string().default('0.1.0'), // trebuie să corespundă pbn_engine.__version__
  TRUST_PROXY: bool.default(false), // zod 4: default-ul e valoarea de ieșire (boolean)
});

export function loadConfig(env = process.env) {
  const cfg = schema.parse(env);
  if (cfg.NODE_ENV === 'production') {
    const problems = [];
    if (cfg.STORAGE_DRIVER !== 's3') problems.push('STORAGE_DRIVER must be s3');
    if (cfg.KEY_PROVIDER !== 'kms') problems.push('KEY_PROVIDER must be kms');
    if (!cfg.AUTH_JWKS_URL) problems.push('AUTH_JWKS_URL is required');
    if (!cfg.GOOGLE_CLIENT_ID || !cfg.GOOGLE_CLIENT_SECRET) problems.push('Google OAuth credentials missing');
    if (problems.length) throw new Error(`Invalid production config: ${problems.join('; ')}`);
  }
  return Object.freeze(cfg);
}
