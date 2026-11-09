/** Construirea dependențelor reale (injectate în app și în workeri; în teste se pot înlocui). */
import { Redis } from 'ioredis';
import { createPool } from './db.js';
import { createKeyProvider } from './crypto/keys.js';
import { createStorage } from './storage/index.js';
import { createQueues } from './queue/index.js';
import { GoogleOAuth } from './integrations/google/oauth.js';
import { GooglePhotosPicker } from './integrations/google/picker.js';
import { PexelsSource, UnsplashSource } from './catalog/stockSources.js';

export async function createDeps(cfg) {
  const db = createPool(cfg.DATABASE_URL);
  const redis = new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 3 });
  const sources = [];
  if (cfg.UNSPLASH_ACCESS_KEY) sources.push(new UnsplashSource({ accessKey: cfg.UNSPLASH_ACCESS_KEY }));
  if (cfg.PEXELS_API_KEY) sources.push(new PexelsSource({ apiKey: cfg.PEXELS_API_KEY }));

  const deps = {
    cfg,
    db,
    redis,
    storage: await createStorage(cfg),
    keyProvider: await createKeyProvider(cfg),
    queues: createQueues({ redisUrl: cfg.REDIS_URL, prefix: cfg.QUEUE_PREFIX }),
    googleOAuth: new GoogleOAuth({
      clientId: cfg.GOOGLE_CLIENT_ID,
      clientSecret: cfg.GOOGLE_CLIENT_SECRET,
      redirectUri: `${cfg.PUBLIC_API_URL}/v1/integrations/google/callback`,
      redis,
    }),
    picker: new GooglePhotosPicker(),
    sources,
  };
  deps.close = async () => {
    await deps.queues.close();
    redis.disconnect();
    await db.end();
  };
  return deps;
}
