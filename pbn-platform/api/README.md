# pbn-api — API-ul Node.js al platformei

Fastify 5 · PostgreSQL · BullMQ 6 (Redis) · S3 · KMS. Arhitectura completă: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

| Proces | Comandă | Rol |
|---|---|---|
| API HTTP | `npm start` | Auth, OAuth Google, upload-uri, comenzi, catalog |
| Worker ingestie (Node) | `npm run worker:ingest` | Polling Google Picker, decriptare upload-uri, import catalog, reaper |
| Worker procesare (Python) | `python -m pbn_worker` (în `../processing`) | Rulează `pbn_engine` pentru job-urile din `pbn-orders` / `pbn-catalog` |
| Import catalog manual | `npm run catalog:ingest -- --theme "alpine lake" --category peisaje` | Modulul 1, la cerere (Unsplash/Pexels) |
| Import dintr-un folder | `npm run catalog:ingest -- --theme demo --from-dir ./poze --approve` | Poze proprii/licențiate, publicate direct |

## Pornire locală

```bash
cp .env.example .env            # completați GOOGLE_*, UNSPLASH_*, PEXELS_*
npm ci
psql "$DATABASE_URL" -f ../db/schema.sql
npm start & npm run worker:ingest &
(cd ../processing && pip install -r requirements.txt && python -m pbn_worker)
```

Sau totul în containere: `docker compose up --build` din `pbn-platform/`.

## Endpoint-uri

Toate rutele `/v1/*` (cu excepția callback-ului OAuth și a catalogului) cer `Authorization: Bearer <JWT>`.
Modulul 2 (marcat ★) cere planul **premium** (`users.plan`).

| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/v1/integrations/google/connect?returnTo=/cale` ★ | `{ authUrl }`: URL-ul ecranului de consimțământ Google (PKCE) |
| GET | `/v1/integrations/google/callback` | Redirect de la Google → `APP_URL/cale?google=connected\|denied\|error` |
| GET / DELETE | `/v1/integrations/google` | Starea conexiunii / deconectare (revocă token-ul la Google) |
| POST | `/v1/integrations/google/picker-sessions` ★ | `{ sessionId, pickerUri }`: clientul deschide `pickerUri`, serverul face polling |
| GET | `/v1/integrations/google/picker-sessions/:id` | `pending → ingesting → ingested` + `sourceImageIds` |
| POST | `/v1/uploads` ★ | `{ uploadId, upload: {url, headers}, encryption: {publicKeySpki} }` |
| POST | `/v1/uploads/:id/complete` ★ | `{ wrappedKey, iv, sha256 }` după PUT-ul ciphertext-ului |
| GET | `/v1/uploads/:id` | `issued → uploaded → ingested \| failed` + `sourceImageId` |
| POST | `/v1/orders` | Comandă din catalog (`catalogDesignId`) sau personalizată (`sourceImageId`, `numColors`, `canvasWmm`, `canvasHmm`) |
| GET | `/v1/orders` | Comenzile utilizatorului |
| GET | `/v1/orders/:id` | Comanda + job-urile ei |
| POST | `/v1/orders/:id/approve` | `{ jobId }`: clientul aprobă varianta → `awaiting_payment` |
| GET | `/v1/jobs/:id` | Starea procesării, rețeta de vopsele + linkuri temporare (15 min) către SVG/PDF/rețetă/mockup |
| GET | `/v1/catalog?category=&limit=` | Designuri publicate (cu atribuirea autorului și imaginile mockup / pictat / numerotat) |
| POST | `/v1/dev/session` | **Doar în dezvoltare**: `{ email, plan }` → JWT de test (dezactivat când `NODE_ENV=production`) |

Aplicația web (catalog, creare din poză, comenzi, previzualizare, aprobare) e servită de API la `/`
(fișierele din `public/`, fără pas de build).

### Frontend: upload din iCloud Photos

```js
import { secureUpload } from './secure-upload.js'; // api/web/secure-upload.js
const file = input.files[0];                       // <input type="file" accept="image/*">
const { uploadId } = await secureUpload(file, { apiBase: '/v1', token });
// apoi GET /v1/uploads/:id până la status = 'ingested' → sourceImageId → POST /v1/orders
```

### Frontend: Google Photos

```js
const { authUrl } = await api.get('/v1/integrations/google/connect?returnTo=/create'); // o singură dată
location.href = authUrl;
// ...după întoarcere:
const { sessionId, pickerUri } = await api.post('/v1/integrations/google/picker-sessions', { maxItems: 5 });
window.open(pickerUri);                                      // utilizatorul alege în Google Photos
// GET /v1/integrations/google/picker-sessions/:id până la status = 'ingested'
```

## Configurare Google Cloud

1. Activați **Google Photos Picker API** în proiect.
2. Ecran de consimțământ OAuth cu scope-ul `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
   (scope sensibil: aplicația trebuie verificată de Google înainte de lansarea publică).
3. Client OAuth „Web application" cu redirect URI `${PUBLIC_API_URL}/v1/integrations/google/callback`.

## Configurare AWS KMS (producție)

- `KMS_TOKEN_KEY_ID`: cheie simetrică — envelope encryption pentru token-urile OAuth.
- `KMS_UPLOAD_KEY_ID`: cheie asimetrică `RSA_3072`, utilizare `ENCRYPT_DECRYPT` — browserul primește cheia publică;
  doar worker-ul de ingestie are `kms:Decrypt` pe ea (politică IAM separată de API).

## Teste

```bash
npm test                                                     # unitare (fără infrastructură)
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres \
TEST_REDIS_URL=redis://localhost:6379 npm test               # + integrare (PG, Redis, worker Python real)
```

Testul de integrare creează o bază de date temporară din `../db/schema.sql`, rulează fluxurile complete
(upload criptat, OAuth + Picker cu Google simulat la nivel HTTP, comandă, import catalog, reaper) și pornește
worker-ul Python real, care procesează job-ul și publică fișierele de producție.
