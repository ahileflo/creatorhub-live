# PBN: platforma Paint-by-Numbers

## Arhitectura

```
                     ┌─────────────── Modul 1: Catalog ───────────────┐
 Pexels API ──► catalog.py (ProcessPool) ──► pbn.py ──► S3 catalog/{cat}/pexels-{id}/v1/c{24,36}/
                                                              │
                                                       catalog_items (Postgres, QA → published)

                     ┌─────────────── Modul 2: Premium ───────────────┐
 Client ─► premium-import.html
    ├─ Google Photos ─► /auth/google (OAuth, scope picker) ─► Picker API session ─► API descarcă =d ─► S3 orders/…/source/
    └─ iCloud / galerie ─► <input type=file> (Photo Picker iOS) ─► URL pre-semnat ─► PUT direct în S3 orders/…/source/
                                                   │
                     API Node (Express) ── INSERT processing_jobs ──► Redis LIST pbn:jobs (premium = prioritate)
                                                   │
                     N × worker.py (BRPOP) ──► pbn.py ──► S3 orders/{yyyy}/{mm}/{order}/job-{id}/
                                                   │          canvas.svg · canvas.pdf · preview.png · mockup.jpg · recipe.json
                                                   └──► processing_jobs.status=done ─► email previzualizare ─► aprobare ─► print
```

| Componentă | Fișier | Rol |
|---|---|---|
| Motor | `engine/pbn.py` | K-Means în Lab, unirea culorilor apropiate (ΔE), curățare zone mici, contururi SVG, numere în polul de inaccesibilitate, rețeta de vopsea |
| Catalog | `engine/catalog.py` | Sute de modele din Pexels, procesate în paralel, cu dovada licenței salvată |
| Worker | `engine/worker.py` | Consumă coada, procesează, urcă rezultatele, reîncearcă de 3 ori |
| Stocare | `engine/storage.py` | Local sau S3/R2, chei organizate pe comenzi |
| API | `api/src/*.js` | Comenzi, OAuth Google Photos Picker, URL-uri pre-semnate, coadă, `/health` |
| Client | `api/public/premium-import.html` | Butoanele „Google Photos” și „iCloud / galerie” |
| DB | `db/schema.sql` | `catalog_items`, `orders`, `processing_jobs`, `stuck_jobs`, `data_retention_log` |
| S3 | `db/s3-lifecycle.json` | Originalele clienților se șterg după 30 de zile; fișierele de producție trec în arhivă după 90 |

## Rulare

```bash
pip install -r pbn/requirements.txt
python -m pbn.engine.pbn poza.jpg out/ --colors 24 --width-cm 40 --height-cm 50
python -m pytest -q pbn/tests
```

Stack complet local (Postgres + Redis + MinIO + API + 2 workeri):
```bash
cd pbn && docker compose up --build
```
Apoi deschideți http://localhost:8080/premium-import.html.

## Note tehnice importante

- **Google Photos**: din 31 martie 2025, Library API nu mai dă acces la toată biblioteca. Folosim **Picker API** (`photospicker.mediaitems.readonly`): utilizatorul alege poza în interfața Google. Nu stocăm refresh token, iar accesul durează doar cât sesiunea.
- **iCloud**: Apple nu are API web pentru iCloud Photos (CloudKit accesează doar datele aplicației voastre). Pe iPhone, `<input type="file">` deschide Photo Picker-ul nativ, care include iCloud Photos, așa că experiența e la fel de directă. HEIC e suportat prin `pillow-heif`.
- **Criptare**: TLS + SSE-AES256 + URL-uri pre-semnate de 10 minute + ștergere automată. Criptarea end-to-end în browser nu ar adăuga protecție, pentru că workerul trebuie oricum să vadă poza ca s-o proceseze.
- **Calibrare vopsea**: `ml_per_cm2=0.012` × 2 straturi × 1,35 pierderi e un punct de pornire. Pictați 3 kituri de test, cântăriți cupele înainte și după, apoi ajustați.
- **Scalare**: un worker procesează o imagine de 1600 px în ~2-6 s. 500 de modele de catalog × 2 variante ≈ 1 oră pe 4 nuclee. Pentru vârfuri (Black Friday, Crăciun) adăugați replici de worker; Postgres rămâne sursa de adevăr, deci se pot reporni oricând.
