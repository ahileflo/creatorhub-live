# Tablouri pe numere — platforma POD

Clientul alege o fotografie (din catalog, din telefon/iCloud sau din Google Photos). Platforma generează automat
pânza cu contururi numerotate (SVG/PDF de print), rețeta de vopsele (ml per culoare) și mockup-urile.
Apoi clientul aprobă varianta.

Detalii tehnice: [`ARCHITECTURE.md`](ARCHITECTURE.md) · API: [`api/README.md`](api/README.md) · motor: [`processing/README.md`](processing/README.md)

## Pornire rapidă (local)

Varianta cu Docker:

```bash
cd pbn-platform
docker compose up --build             # aplicația: http://localhost:8080
# opțional: importă un folder de poze în catalog
docker compose cp ./poze api:/tmp/poze
docker compose exec api node src/catalog/cli.js --theme demo --category diverse --from-dir /tmp/poze --approve
```

Varianta fără Docker (PostgreSQL ≥ 15 și Redis 7 instalate local):

```bash
psql "$DATABASE_URL" -f db/schema.sql
(cd api && npm ci && cp .env.example .env && npm start)        # API + aplicația web
(cd api && npm run worker:ingest)                               # Google Photos, upload-uri, catalog
(cd processing && pip install -r requirements.txt && python -m pbn_worker)   # procesarea imaginilor
(cd api && npm run catalog:ingest -- --theme demo --from-dir ~/Poze/demo --approve)
```

În mediul de dezvoltare, „Intră în cont” creează un utilizator de test (Premium sau Gratuit) fără parolă.

## Teste

| Comandă | Ce verifică |
|---|---|
| `cd processing && python -m pytest -q` | motorul de procesare, worker-ul Python, citirea HEIC |
| `cd api && npm test` | API-ul (unitare); cu `TEST_DATABASE_URL` și `TEST_REDIS_URL`, și integrarea pe PostgreSQL + Redis + worker-ul Python real |
| `PG_ADMIN_URL=… REDIS_URL=… scripts/e2e.sh` | toată platforma pornită, testată într-un browser real: catalog, login, upload criptat, generare, previzualizare, descărcare PDF, aprobare, comenzi, mobil |

CI-ul (`.github/workflows/pbn-platform.yml`) rulează toate trei la fiecare push. Capturile din browser apar ca artefact `e2e-screenshots`.

## Ce trebuie să faci tu înainte de lansare

Lucrurile de mai jos nu se pot face din cod: cer conturile, cheile sau deciziile tale.

1. **Autentificarea clienților.** Login-ul de test e dezactivat automat în producție. Alege un furnizor de identitate
   (AWS Cognito, Auth0 sau Clerk) și setează `AUTH_JWKS_URL`, `AUTH_ISSUER` și `AUTH_AUDIENCE`. Furnizorul trebuie să emită
   `sub` = UUID-ul utilizatorului.
2. **Google Photos.** În Google Cloud Console:
   - activează *Google Photos Picker API*;
   - creează un client OAuth „Web application” cu redirect `https://<domeniul-api>/v1/integrations/google/callback`;
   - completează ecranul de consimțământ.

   Scope-ul `photospicker.mediaitems.readonly` cere **verificarea aplicației de către Google**, care poate dura câteva
   săptămâni. Până atunci funcționează doar pentru utilizatorii de test adăugați de tine.
   Setează `GOOGLE_CLIENT_ID` și `GOOGLE_CLIENT_SECRET`.
3. **AWS.**
   - Bucket-uri S3 `…-sources` și `…-artifacts` cu criptare SSE-KMS și CORS pentru `PUT` din domeniul aplicației.
   - Cheie KMS simetrică pentru token-uri (`KMS_TOKEN_KEY_ID`).
   - Cheie KMS asimetrică `RSA_3072` / `ENCRYPT_DECRYPT` pentru upload-uri (`KMS_UPLOAD_KEY_ID`). Doar worker-ul de ingestie
     trebuie să aibă `kms:Decrypt` pe ea.
   - Regulile de ciclu de viață din `ARCHITECTURE.md` §6.2.
4. **Catalogul automat.** Creează aplicații pe Unsplash și Pexels și setează `UNSPLASH_ACCESS_KEY` și `PEXELS_API_KEY`.
   Pentru volume mari, cere la Unsplash trecerea la *production* (limitele aplicațiilor demo sunt mici).
   Alege temele în `CATALOG_THEMES`.
5. **Verificare juridică.** Licențele Unsplash și Pexels interzic vânzarea fotografiilor nemodificate. Portretele cu persoane
   recognoscibile nu au acordul acelor persoane (platforma le exclude automat din catalog). Cere confirmarea unui jurist
   înainte de vânzare.
6. **Plata.** Comanda aprobată ajunge în starea „Aprobată — urmează plata”. Integrarea cu un procesator de plăți
   (ex. Stripe Checkout) cere contul tău și se adaugă ca pas următor.
7. **Calibrarea vopselei și a tiparului.**
   - Cantitățile (ml) sunt estimate. După primele kituri, ajustează `wet_film_mm` în `processing/pbn_engine/config.py`.
   - Pentru CMYK exact, cere profilul ICC de la tipografie și rulează procesarea cu el.
8. **Găzduirea.** Containerele (`api/Dockerfile`, `processing/Dockerfile`) rulează pe ECS, Kubernetes sau Cloud Run. Ai nevoie de:
   - PostgreSQL administrat (RDS / Cloud SQL);
   - Redis cu `maxmemory-policy noeviction`;
   - un domeniu cu HTTPS.

   `docker compose` e scris, dar nu a putut fi rulat în mediul în care a fost dezvoltat (fără Docker).
